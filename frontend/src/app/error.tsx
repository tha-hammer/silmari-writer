'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <div className="flex items-center justify-center min-h-screen p-8">
      <div className="text-center max-w-md">
        <h2 className="text-xl font-bold mb-2">Something went wrong!</h2>
        <p className="text-muted-foreground mb-4">{error.message}</p>
        <button
          onClick={reset}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
