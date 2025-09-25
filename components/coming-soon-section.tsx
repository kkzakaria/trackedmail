interface ComingSoonSectionProps {
  title: string;
  description: string;
  features: string[];
  icon: React.ReactNode;
}

export function ComingSoonSection({
  title,
  description,
  features,
  icon,
}: ComingSoonSectionProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-white to-gray-50 px-4 pt-16">
      <div className="mx-auto max-w-2xl text-center">
        <div className="mb-8">
          <div className="mb-6 flex justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg">
              {icon}
            </div>
          </div>
          <h1 className="mb-4 text-4xl font-bold tracking-tight text-gray-900 md:text-5xl">
            {title}
          </h1>
          <div className="mx-auto mb-8 h-1 w-24 rounded-full bg-gradient-to-r from-blue-500 to-indigo-500"></div>
        </div>

        <h2 className="mb-6 text-xl font-semibold text-gray-700 md:text-2xl">
          Bientôt Disponible
        </h2>

        <p className="mx-auto mb-8 max-w-xl text-lg leading-relaxed text-gray-600">
          {description}
        </p>

        <div className="mb-8 rounded-2xl border border-white/20 bg-white/70 p-8 shadow-xl backdrop-blur-sm">
          <div className="mb-6 flex items-center justify-center">
            <div className="relative">
              <div className="h-16 w-16 animate-spin rounded-full border-4 border-blue-200 border-t-blue-500"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-8 w-8 rounded-full bg-blue-500"></div>
              </div>
            </div>
          </div>

          <p className="mb-4 font-medium text-gray-600">
            Fonctionnalités prévues :
          </p>
          <div className="grid grid-cols-1 gap-2 text-sm text-gray-600 md:grid-cols-2">
            {features.map((feature, index) => (
              <div key={index} className="flex items-center justify-center">
                <span className="mr-2 h-2 w-2 rounded-full bg-blue-500"></span>
                {feature}
              </div>
            ))}
          </div>
        </div>

        <div className="text-center">
          <p className="text-sm text-gray-500">
            Cette section est en cours de développement et sera bientôt
            disponible.
          </p>
        </div>
      </div>
    </div>
  );
}
