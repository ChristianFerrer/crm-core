import { redirect } from 'next/navigation'

// Ruta heredada del antiguo check-in. El histórico de visitas vive ahora en
// /miembros/historico; mantenemos este redirect para enlaces y marcadores antiguos.
export default function CheckinRedirect() {
  redirect('/miembros/historico')
}
