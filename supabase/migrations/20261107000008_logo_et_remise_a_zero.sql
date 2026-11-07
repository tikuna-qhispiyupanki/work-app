-- ============================================================================
-- Arboject – logo de l'entreprise et remise à zéro du compteur de devis
-- 1. Les photos peuvent être un logo (kind = 'logo').
-- 2. Le compteur de devis a une « série » (epoch). Quand on remet le compteur à zéro, la série
--    change : chaque téléphone jette alors ses numéros réservés d'avance (sinon doublons).
-- ============================================================================
alter table public.photos drop constraint photos_kind_check;
alter table public.photos add constraint photos_kind_check check (kind in ('photo', 'plan', 'croquis', 'signature', 'logo'));

alter table public.quote_counters add column epoch integer not null default 1;

drop function public.reserve_quote_numbers(uuid, integer, integer);
create function public.reserve_quote_numbers(p_company uuid, p_year integer, p_count integer)
returns table (first_number integer, last_number integer, epoch integer)
language plpgsql security definer set search_path = public, private as $$
declare v_last integer; v_epoch integer;
begin
  if not private.can_edit_visits(p_company) then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  if p_count < 1 or p_count > 50 or p_year < 2020 or p_year > 2100 then
    raise exception 'Demande invalide' using errcode = '22023';
  end if;
  insert into quote_counters as c (company_id, year, last_number) values (p_company, p_year, p_count)
  on conflict (company_id, year) do update set last_number = c.last_number + p_count
  returning c.last_number, c.epoch into v_last, v_epoch;
  return query select v_last - p_count + 1, v_last, v_epoch;
end;
$$;
revoke all on function public.reserve_quote_numbers(uuid, integer, integer) from public, anon;
grant execute on function public.reserve_quote_numbers(uuid, integer, integer) to authenticated;

-- Série actuelle du compteur (0 si aucun numéro n'a encore été réservé cette année).
create function public.quote_counter_epoch(p_company uuid, p_year integer)
returns integer language plpgsql stable security definer set search_path = public, private as $$
declare v integer;
begin
  if not private.can_edit_visits(p_company) then
    raise exception 'Accès refusé' using errcode = '42501';
  end if;
  select epoch into v from quote_counters where company_id = p_company and year = p_year;
  return coalesce(v, 0);
end;
$$;
revoke all on function public.quote_counter_epoch(uuid, integer) from public, anon;
grant execute on function public.quote_counter_epoch(uuid, integer) to authenticated;
