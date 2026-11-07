import { useQuery } from "@powersync/react";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { confirmAction } from "@/components/confirm";
import { FileButton } from "@/components/file-button";
import { Icon } from "@/components/icon";
import { Segmented } from "@/components/segmented";
import { Button, Card, Muted, SecondaryButton } from "@/components/ui";
import { Colors, Spacing } from "@/constants/theme";
import { CLIENTS_FOR_IMPORT_SQL, importClients } from "@/db/clients";
import {
  buildCandidates,
  Candidate,
  columnLabel,
  decodeText,
  ExistingClient,
  findHeaderRow,
  guessMapping,
  IMPORT_FIELDS,
  ImportField,
  Mapping,
  MAX_ROWS,
  parseCsv,
  Table,
  tableFromSheet,
} from "@/domain/client-import";
import { readWorkbook } from "@/domain/xlsx";
import { shareFile } from "@/pdf/share";

type Loaded = { fileName: string; sheets: { name: string; table: Table }[] };
type View_ = "nouveau" | "doublon" | "ignore";

const TEMPLATE =
  "Nom;Prénom;Société;Téléphone;E-mail;Adresse;Code postal;Commune;Notes\r\nPayet;Jean;;0692 11 22 33;jean.payet@exemple.fr;12 chemin des Filaos;97434;Saint-Gilles-les-Bains;Portail vert\r\n";

// Import du carnet de clients depuis un fichier Excel (.xlsx) ou CSV.
export default function ClientImportScreen() {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [mapping, setMapping] = useState<Mapping>({});
  const [headerRow, setHeaderRow] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<number | null>(null);
  const [view, setView] = useState<View_>("nouveau");
  const [picking, setPicking] = useState<ImportField | null>(null);
  const [lastPicked, setLastPicked] = useState<ImportField>("name"); // garde le titre pendant la fermeture
  const { data: existing } = useQuery<ExistingClient>(CLIENTS_FOR_IMPORT_SQL);

  const table = loaded?.sheets[sheetIndex]?.table ?? [];
  const headers = table[headerRow] ?? [];
  const candidates = useMemo(
    () => (loaded ? buildCandidates(table, headerRow, mapping, existing) : []),
    [loaded, table, headerRow, mapping, existing],
  );
  const groups: Record<View_, Candidate[]> = {
    nouveau: candidates.filter((c) => c.status === "nouveau"),
    doublon: candidates.filter(
      (c) => c.status === "doublon" || c.status === "doublon_fichier",
    ),
    ignore: candidates.filter((c) => c.status === "sans_nom"),
  };
  const nameMapped =
    mapping.name !== undefined ||
    mapping.lastName !== undefined ||
    mapping.firstName !== undefined ||
    mapping.company !== undefined;

  const choose = (sheets: Loaded["sheets"], index: number) => {
    const t = sheets[index]?.table ?? [];
    const h = findHeaderRow(t);
    setSheetIndex(index);
    setHeaderRow(h);
    setMapping(guessMapping(t[h] ?? []));
    setView("nouveau");
  };

  const onFile = async (f: File) => {
    setError(null);
    setDone(null);
    setLoaded(null);
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b; // « PK » : un .xlsx est une archive zip
      let sheets: Loaded["sheets"];
      if (isZip) {
        sheets = [...readWorkbook(bytes)]
          .map(([name, sheet]) => ({ name, table: tableFromSheet(sheet) }))
          .filter((s) => s.table.length > 0);
      } else if (/\.(xls|numbers|ods)$/i.test(f.name) || bytes[0] === 0xd0) {
        throw new Error(
          "Ce format n'est pas lu. Dans Excel ou Numbers, enregistre le fichier en « .xlsx » ou en « .csv », puis réessaie.",
        );
      } else {
        sheets = [{ name: f.name, table: parseCsv(decodeText(bytes)) }];
      }
      if (!sheets.length || sheets.every((s) => s.table.length < 2))
        throw new Error(
          "Le fichier ne contient pas de tableau (il faut une ligne de titres puis au moins un client).",
        );
      const start = Math.max(
        0,
        sheets.findIndex((s) => s.table.length >= 2),
      );
      setLoaded({ fileName: f.name, sheets });
      choose(sheets, start);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const run = async () => {
    const list = groups.nouveau.map((c) => c.client);
    if (!list.length) return;
    const ok = await confirmAction(
      `Importer ${list.length} client${list.length > 1 ? "s" : ""} ?`,
      `Ils sont ajoutés au carnet. Les doublons (${groups.doublon.length}) et les lignes sans nom (${groups.ignore.length}) sont laissés de côté.`,
      "Importer",
    );
    if (!ok) return;
    setBusy(true);
    try {
      setDone(await importClients(list));
      setLoaded(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  };

  const sample = (col: number) =>
    table
      .slice(headerRow + 1)
      .map((r) => r[col])
      .find((v) => v) ?? "";
  const colText = (col: number | undefined) =>
    col === undefined
      ? "non utilisé"
      : `${columnLabel(col)} · ${headers[col] || "sans titre"}`;

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      {done !== null ? (
        <Card title="Import terminé">
          <Text style={styles.ok}>
            {done} client{done > 1 ? "s" : ""} ajouté{done > 1 ? "s" : ""} au
            carnet.
          </Text>
          <Muted>
            Ils seront envoyés au serveur dès qu&apos;il y a du réseau (pastille
            en haut).
          </Muted>
          <Button
            label="Voir le carnet"
            icon="people-outline"
            onPress={() => router.back()}
          />
        </Card>
      ) : null}

      {!loaded ? (
        <Card title="Importer un fichier de clients">
          <Muted>
            Choisis un fichier Excel (.xlsx) ou CSV. Une ligne par client, avec
            une ligne de titres au-dessus (Nom, Prénom, Téléphone, E-mail,
            Adresse, Code postal, Commune…). Tu pourras vérifier les colonnes et
            voir un aperçu avant d&apos;importer : rien n&apos;est ajouté sans
            ton accord.
          </Muted>
          <FileButton
            label="Choisir le fichier (Excel ou CSV)"
            icon="document-attach-outline"
            accept=".xlsx,.csv,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onFile={onFile}
          />
          <SecondaryButton
            label="Télécharger un modèle à remplir"
            icon="download-outline"
            onPress={() =>
              void shareFile(
                new TextEncoder().encode("﻿" + TEMPLATE).buffer as ArrayBuffer,
                "modele-clients-arboject.csv",
                "text/csv",
              )
            }
          />
          <Muted>
            Les doublons (même téléphone, même e-mail, ou même nom et code
            postal) sont repérés et laissés de côté.
          </Muted>
        </Card>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loaded ? (
        <>
          <Card title={loaded.fileName}>
            <Muted>
              {Math.max(0, table.length - headerRow - 1)} ligne
              {table.length - headerRow - 1 > 1 ? "s" : ""} sous les titres
              (ligne {headerRow + 1})
              {table.length - headerRow - 1 > MAX_ROWS
                ? ` — seules les ${MAX_ROWS} premières sont lues`
                : ""}
              .
            </Muted>
            {loaded.sheets.length > 1 ? (
              <View style={styles.chips}>
                {loaded.sheets.map((s, i) => (
                  <Pressable
                    key={s.name}
                    onPress={() => choose(loaded.sheets, i)}
                    style={[styles.chip, i === sheetIndex && styles.chipOn]}
                    accessibilityRole="radio"
                    aria-checked={i === sheetIndex}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        i === sheetIndex && { color: Colors.primaryText },
                      ]}
                    >
                      Onglet « {s.name} »
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            <View style={styles.row}>
              <Muted>Ligne des titres : {headerRow + 1}</Muted>
              <Pressable
                style={styles.small}
                onPress={() => headerRow > 0 && setHeaderRow(headerRow - 1)}
                accessibilityRole="button"
                accessibilityLabel="Ligne des titres plus haut"
              >
                <Icon name="chevron-up" size={18} color={Colors.primary} />
              </Pressable>
              <Pressable
                style={styles.small}
                onPress={() =>
                  headerRow < table.length - 2 && setHeaderRow(headerRow + 1)
                }
                accessibilityRole="button"
                accessibilityLabel="Ligne des titres plus bas"
              >
                <Icon name="chevron-down" size={18} color={Colors.primary} />
              </Pressable>
            </View>
            <SecondaryButton
              label="Choisir un autre fichier"
              icon="refresh-outline"
              onPress={() => setLoaded(null)}
            />
          </Card>

          <Card title="Colonnes">
            <Muted>
              Vérifie ce que j&apos;ai reconnu. Touche une ligne pour changer la
              colonne.
            </Muted>
            {IMPORT_FIELDS.map((f) => (
              <Pressable
                key={f.key}
                style={styles.mapRow}
                onPress={() => {
                  setLastPicked(f.key);
                  setPicking(f.key);
                }}
                accessibilityRole="button"
                accessibilityLabel={`Colonne pour ${f.label} : ${colText(mapping[f.key])}`}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.mapLabel}>{f.label}</Text>
                  {f.hint ? <Text style={styles.hint}>{f.hint}</Text> : null}
                </View>
                <View style={{ flex: 1, alignItems: "flex-end" }}>
                  <Text
                    style={[
                      styles.mapValue,
                      mapping[f.key] === undefined && styles.unused,
                    ]}
                    numberOfLines={1}
                  >
                    {colText(mapping[f.key])}
                  </Text>
                  {mapping[f.key] !== undefined && sample(mapping[f.key]!) ? (
                    <Text style={styles.hint} numberOfLines={1}>
                      ex. {sample(mapping[f.key]!)}
                    </Text>
                  ) : null}
                </View>
                <Icon
                  name="chevron-forward"
                  size={18}
                  color={Colors.textSecondary}
                />
              </Pressable>
            ))}
            {!nameMapped ? (
              <Text style={styles.warn}>
                Choisis au moins la colonne du nom (ou de la société).
              </Text>
            ) : null}
          </Card>

          <Text style={styles.section}>Aperçu</Text>
          <Segmented<View_>
            value={view}
            onChange={setView}
            items={[
              {
                key: "nouveau",
                label: "Nouveaux",
                count: groups.nouveau.length,
              },
              {
                key: "doublon",
                label: "Doublons",
                count: groups.doublon.length,
              },
              { key: "ignore", label: "Sans nom", count: groups.ignore.length },
            ]}
          />
          <Card>
            {groups[view].length === 0 ? <Muted>Aucune ligne.</Muted> : null}
            {groups[view].slice(0, 100).map((c) => (
              <View key={c.line} style={styles.item}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>
                    {c.client.name || "(sans nom)"}
                    {c.client.kind === "professionnel" ? " · Pro" : ""}
                  </Text>
                  <Text style={styles.hint}>
                    {[
                      c.client.phone,
                      c.client.email,
                      [c.client.postalCode, c.client.city]
                        .filter(Boolean)
                        .join(" "),
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Pas de coordonnées"}
                  </Text>
                  {c.reason ? (
                    <Text style={styles.reason}>{c.reason}</Text>
                  ) : null}
                </View>
                <Text style={styles.hint}>ligne {c.line}</Text>
              </View>
            ))}
            {groups[view].length > 100 ? (
              <Muted>… et {groups[view].length - 100} autres.</Muted>
            ) : null}
          </Card>

          <Button
            label={
              busy
                ? "Import en cours…"
                : groups.nouveau.length
                  ? `Importer ${groups.nouveau.length} client${groups.nouveau.length > 1 ? "s" : ""}`
                  : "Aucun nouveau client à importer"
            }
            icon="cloud-download-outline"
            onPress={run}
            disabled={busy || !groups.nouveau.length || !nameMapped}
          />
        </>
      ) : null}

      <Modal
        visible={picking !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPicking(null)}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => setPicking(null)}
          accessibilityLabel="Fermer"
        >
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>
              {IMPORT_FIELDS.find((f) => f.key === lastPicked)?.label} : quelle
              colonne ?
            </Text>
            <ScrollView style={{ maxHeight: 420 }}>
              {[undefined, ...headers.map((_, i) => i)].map((col) => {
                const on = mapping[lastPicked] === col;
                return (
                  <Pressable
                    key={col ?? "none"}
                    style={[
                      styles.option,
                      on && { backgroundColor: "#E6EFEC" },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={
                      col === undefined
                        ? "Ne pas utiliser"
                        : `Colonne ${colText(col)}`
                    }
                    onPress={() => {
                      if (picking) {
                        const next = { ...mapping };
                        if (col === undefined) delete next[picking];
                        else next[picking] = col;
                        setMapping(next);
                      }
                      setPicking(null);
                    }}
                  >
                    <Text style={styles.mapLabel}>
                      {col === undefined ? "Ne pas utiliser" : colText(col)}
                    </Text>
                    {col !== undefined && sample(col) ? (
                      <Text style={styles.hint}>ex. {sample(col)}</Text>
                    ) : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.md,
    gap: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  ok: { fontSize: 17, fontWeight: "600", color: Colors.primary },
  error: { color: Colors.danger, fontSize: 15 },
  warn: { color: Colors.warning, fontSize: 15, fontWeight: "500" },
  row: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  small: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    padding: 6,
    backgroundColor: Colors.card,
  },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chipOn: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: 15, color: Colors.text },
  mapRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  mapLabel: { fontSize: 16, color: Colors.text },
  mapValue: { fontSize: 15, fontWeight: "600", color: Colors.primary },
  unused: { color: Colors.textSecondary, fontWeight: "400" },
  hint: { fontSize: 13, color: Colors.textSecondary },
  item: {
    flexDirection: "row",
    gap: Spacing.sm,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  name: { fontSize: 16, fontWeight: "500", color: Colors.text },
  reason: { fontSize: 13, color: Colors.warning },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: Spacing.md,
    paddingBottom: Spacing.lg,
    maxWidth: 720,
    width: "100%",
    alignSelf: "center",
  },
  section: {
    fontSize: 18,
    fontWeight: "600",
    color: Colors.text,
    marginBottom: -Spacing.sm,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  option: {
    paddingVertical: 12,
    paddingHorizontal: Spacing.sm,
    borderRadius: 8,
  },
});
