import { buildIcs, CalendarEvent } from '@/domain/calendar';

// Ouvre le rendez-vous dans le calendrier du téléphone.
// iPhone : Safari affiche la fiche « Ajouter au calendrier ». Ordinateur : téléchargement du fichier .ics.
export function addToCalendar(event: CalendarEvent, fileName: string) {
  const ics = buildIcs(event);
  const isApple = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent) && 'ontouchend' in document;
  if (isApple) {
    // Lien « data: » de type text/calendar : Safari iOS le reconnaît et propose l'ajout au Calendrier.
    window.location.href = `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
    return;
  }
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
