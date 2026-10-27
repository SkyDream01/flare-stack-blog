export function AuthHeading({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <header className="auth-heading">
      <h1>{title}</h1>
      {description && <p>{description}</p>}
    </header>
  );
}
