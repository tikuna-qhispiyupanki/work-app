import { useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { confirmAction } from "@/components/confirm";
import { LocalImage } from "@/components/local-image";
import {
  RemoteProof,
  RemoteSign,
  useRemoteDecision,
} from "@/components/remote-sign";
import { SignaturePad, SignaturePadHandle } from "@/components/signature-pad";
import { Button, Card, Field, Muted, SecondaryButton } from "@/components/ui";
import { Colors, Spacing } from "@/constants/theme";
import { QuoteRow, refuseQuote, signQuote } from "@/db/quotes";
import { toDate } from "@/domain/dates";
import { quickPosition } from "@/domain/geo";
import { euros } from "@/domain/pricing";
import { kickUploader } from "@/sync/uploader";

// Signature du client (« Bon pour accord ») sur un devis finalisé. Fonctionne sans réseau.
export function QuoteSign({
  quote,
  clientName,
}: {
  quote: QuoteRow;
  clientName: string | null | undefined;
}) {
  const pad = useRef<SignaturePadHandle>(null);
  const [name, setName] = useState(clientName ?? "");
  const [ink, setInk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const remote = useRemoteDecision(quote.id);
  const snap = <T,>(json: string | null): Partial<T> => {
    try {
      return json ? (JSON.parse(json) as Partial<T>) : {};
    } catch {
      return {};
    }
  };
  const company = snap<{ name: string }>(quote.company_snapshot);
  const client = snap<{ phone: string; email: string }>(quote.client_snapshot);

  if (quote.status === "signe") {
    return (
      <Card title="✓ Signé par le client">
        <Text style={styles.text}>
          Bon pour accord, signé le{" "}
          {toDate(quote.signed_at).toLocaleString("fr-FR", {
            dateStyle: "long",
            timeStyle: "short",
          })}{" "}
          par {quote.signer_name}.
        </Text>
        {!quote.signature_photo_id && remote?.status === "signe" ? (
          <RemoteProof r={remote} />
        ) : null}
        {quote.signature_photo_id ? (
          <View style={{ maxWidth: 320 }}>
            <LocalImage
              fileId={quote.signature_photo_id}
              alt="Signature du client"
              aspectRatio={600 / 240}
              companyId={quote.company_id}
              uploaded
            />
          </View>
        ) : null}
      </Card>
    );
  }
  if (quote.status === "refuse")
    return (
      <Card title="Refusé par le client">
        <Muted>
          {remote?.status === "refuse"
            ? `Refusé par le lien de signature le ${toDate(remote.decided_at).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}${remote.signer_name ? ` (${remote.signer_name})` : ""}.`
            : "Ce devis a été marqué comme refusé."}
        </Muted>
        {remote?.refusal_reason ? (
          <Text style={styles.text}>Motif : {remote.refusal_reason}</Text>
        ) : null}
      </Card>
    );
  if (quote.status !== "finalise") return null;

  const sign = async () => {
    setError(null);
    if (!name.trim())
      return setError("Indique le nom de la personne qui signe.");
    const image = await pad.current?.toJpeg();
    if (!image) return setError("Le client doit signer dans le cadre.");
    setBusy(true);
    try {
      const position = await quickPosition(3000);
      await signQuote(quote.id, name, image, position);
      kickUploader();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card title="✍️ Signature du client">
        <Text style={styles.text}>
          Le client accepte le devis {quote.number} d&apos;un montant de{" "}
          {euros(quote.total_ttc_cents)}{" "}
          {quote.vat_regime === "franchise" ? "(net à payer)" : "TTC"} et ses
          conditions : « Bon pour accord ».
        </Text>
        <Field
          label="Nom de la personne qui signe"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
        />
        <SignaturePad ref={pad} onInk={setInk} />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button
          label={
            busy ? "Enregistrement…" : "Valider la signature (Bon pour accord)"
          }
          onPress={sign}
          disabled={busy || !ink}
          icon="create-outline"
        />
        <SecondaryButton
          label="Le client refuse le devis"
          danger
          onPress={async () => {
            if (
              await confirmAction(
                "Marquer le devis comme refusé ?",
                "Il restera dans l’historique du client.",
                "Refusé",
              )
            )
              await refuseQuote(quote.id).catch((e) => setError(String(e)));
          }}
        />
      </Card>
      <RemoteSign
        quote={quote}
        companyName={company.name ?? ""}
        clientPhone={client.phone}
        clientEmail={client.email}
      />
    </>
  );
}

const styles = StyleSheet.create({
  text: { fontSize: 15, color: Colors.text },
  error: { fontSize: 15, color: Colors.danger },
});
