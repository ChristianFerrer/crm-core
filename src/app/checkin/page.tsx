import { redirect } from 'next/navigation'

// Ruta heredada del antiguo check-in. El histórico de visitas vive ahora en
// /panel/visitas; mantenemos este redirect para enlaces y marcadores antiguos.
export default function CheckinRedirect() {
  redirect('/panel/visitas')
}
