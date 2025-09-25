export default function ComingSoonPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-white to-indigo-50 px-4">
      <div className="mx-auto max-w-2xl text-center">
        <div className="mb-8">
          <h1 className="mb-4 text-5xl font-bold tracking-tight text-gray-900 md:text-6xl">
            TrackedMail
          </h1>
          <div className="mx-auto mb-8 h-1 w-24 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500"></div>
        </div>

        <h2 className="mb-6 text-2xl font-semibold text-gray-700 md:text-3xl">
          Bientôt Disponible
        </h2>

        <p className="mx-auto mb-8 max-w-xl text-lg leading-relaxed text-gray-600">
          Une solution élégante pour le suivi de vos emails et la gestion
          automatique de vos relances. Nous peaufinons les derniers détails pour
          vous offrir une expérience exceptionnelle.
        </p>

        <div className="rounded-2xl border border-white/20 bg-white/70 p-8 shadow-xl backdrop-blur-sm">
          <div className="mb-6 flex items-center justify-center">
            <div className="relative">
              <div className="h-16 w-16 animate-spin rounded-full border-4 border-blue-200 border-t-blue-500"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-8 w-8 rounded-full bg-blue-500"></div>
              </div>
            </div>
          </div>

          <p className="mb-2 font-medium text-gray-600">
            En cours de développement
          </p>
          <p className="text-sm text-gray-500">
            Suivi d&apos;emails • Relances automatiques • Interface moderne
          </p>
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            © 2025 TrackedMail. Tous droits réservés.
          </p>
        </div>
      </div>
    </div>
  );
}
