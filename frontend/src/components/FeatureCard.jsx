/*
 * Reusable feature card used by the Features section.
 *
 * Props:
 *  - icon:  element rendered in the rounded badge
 *  - title: card heading
 *  - text:  short supporting description
 *  - delay: optional CSS animation delay for a staggered entrance
 */
function FeatureCard({ icon, title, text, delay = 0 }) {
  return (
    <article
      className="feature-card animate-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="feature-card__icon">{icon}</div>
      <h3 className="feature-card__title">{title}</h3>
      <p className="feature-card__text">{text}</p>
    </article>
  );
}

export default FeatureCard;
