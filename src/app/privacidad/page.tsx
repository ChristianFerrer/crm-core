export const metadata = { title: 'Política de Privacidad — GERD CRM' }

export default function PrivacidadPage() {
  return (
    <div className="min-h-screen bg-carbon">
      <div className="border-b border-line px-4 py-4 flex items-center gap-3">
        <div className="w-7 h-7 rounded-lg bg-lime flex items-center justify-center shrink-0">
          <span className="text-ink font-bold text-xs">G</span>
        </div>
        <p className="text-sm font-semibold text-snow">GERD CRM</p>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-10 space-y-8 text-snow">
      <div>
        <h1 className="font-display text-2xl font-bold text-snow">Política de Privacidad</h1>
        <p className="text-sm text-mist mt-1">Última actualización: junio 2025 · Versión 1.0</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-snow">1. Responsable del tratamiento</h2>
        <p className="text-sm text-fog leading-relaxed">
          El responsable del tratamiento de los datos personales introducidos en esta plataforma es el centro o ludoteca que contrata el servicio de GERD CRM (en adelante, «el Centro»). El Centro determina los fines y medios del tratamiento de datos de sus clientes.
        </p>
        <p className="text-sm text-fog leading-relaxed">
          GERD CRM actúa como encargado del tratamiento en nombre del Centro, conforme al artículo 28 del Reglamento (UE) 2016/679 (RGPD).
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-snow">2. Datos que se recogen</h2>
        <p className="text-sm text-fog leading-relaxed">A través de esta plataforma el Centro puede registrar los siguientes datos personales:</p>
        <ul className="text-sm text-fog space-y-1 list-disc list-inside ml-2">
          <li>Del tutor/titular: nombre, apellidos, teléfono y correo electrónico.</li>
          <li>De los menores a cargo: nombre y fecha de nacimiento.</li>
          <li>Historial de visitas, bonos contratados y pagos realizados.</li>
        </ul>
        <p className="text-sm text-fog leading-relaxed">
          No se recogen datos especialmente protegidos (salud, biometría, ideología) salvo que el Centro lo indique expresamente en el campo de notas, bajo su propia responsabilidad.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-snow">3. Finalidad y base legal</h2>
        <p className="text-sm text-fog leading-relaxed">Los datos se tratan con las siguientes finalidades:</p>
        <ul className="text-sm text-fog space-y-1 list-disc list-inside ml-2">
          <li>Gestión de accesos, reservas y bonos del centro — base legal: ejecución del contrato.</li>
          <li>Comunicaciones relacionadas con el servicio (recordatorios, alertas de bono) — base legal: interés legítimo.</li>
          <li>Comunicaciones promocionales o de cumpleaños — base legal: consentimiento explícito del tutor.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-snow">4. Plazo de conservación</h2>
        <p className="text-sm text-fog leading-relaxed">
          Los datos se conservan mientras el titular mantenga una relación activa con el Centro. Una vez finalizada la relación, se conservan durante un máximo de 5 años para cumplir las obligaciones fiscales y mercantiles, transcurridos los cuales se eliminan o anonimizan de forma permanente.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-snow">5. Destinatarios y transferencias</h2>
        <p className="text-sm text-fog leading-relaxed">
          Los datos no se ceden a terceros salvo obligación legal. La plataforma utiliza los siguientes subencargados para su funcionamiento, todos ellos con garantías adecuadas conforme al RGPD:
        </p>
        <ul className="text-sm text-fog space-y-1 list-disc list-inside ml-2">
          <li>Supabase Inc. — almacenamiento de base de datos (servidores en la UE).</li>
          <li>Vercel Inc. — alojamiento de la aplicación (servidores en la UE).</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-snow">6. Derechos del interesado</h2>
        <p className="text-sm text-fog leading-relaxed">
          Cualquier persona cuyos datos estén registrados en la plataforma puede ejercer los siguientes derechos ante el Centro:
        </p>
        <ul className="text-sm text-fog space-y-1 list-disc list-inside ml-2">
          <li><strong className="text-snow">Acceso:</strong> conocer qué datos se tienen registrados.</li>
          <li><strong className="text-snow">Rectificación:</strong> corregir datos inexactos o incompletos.</li>
          <li><strong className="text-snow">Supresión:</strong> solicitar la eliminación de sus datos.</li>
          <li><strong className="text-snow">Portabilidad:</strong> recibir sus datos en formato electrónico.</li>
          <li><strong className="text-snow">Oposición:</strong> oponerse al tratamiento para fines de marketing.</li>
        </ul>
        <p className="text-sm text-fog leading-relaxed">
          Para ejercer estos derechos, contacte directamente con el Centro donde está registrado. También puede presentar una reclamación ante la Agencia Española de Protección de Datos (AEPD) en{' '}
          <a href="https://www.aepd.es" target="_blank" rel="noopener noreferrer" className="text-iris underline">www.aepd.es</a>.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-snow">7. Seguridad</h2>
        <p className="text-sm text-fog leading-relaxed">
          GERD CRM aplica medidas técnicas y organizativas adecuadas para garantizar la seguridad de los datos: cifrado en tránsito (TLS), cifrado en reposo (AES-256), control de acceso por tenant y copias de seguridad automáticas diarias.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-snow">8. Menores de edad</h2>
        <p className="text-sm text-fog leading-relaxed">
          Los datos de menores únicamente se recogen con el consentimiento expreso del tutor legal, quien declara estar legitimado para otorgarlo en el momento del registro. El Centro es responsable de verificar dicha legitimación.
        </p>
      </section>

      <div className="border-t border-line pt-6">
        <p className="text-xs text-mist">
          Esta política puede actualizarse. La versión vigente estará siempre disponible en esta página. Los cambios sustanciales se comunicarán a los Centros con antelación suficiente.
        </p>
      </div>
    </div>
    </div>
  )
}
