/** Names at least this long get the surname-first short form on phones. */
const LONG = 15;

/** "Sherman Brandson" → "S. Brandson"; one-word names stay as they are. */
export const surnameFirst = (name: string) => {
  const parts = name.trim().split(/\s+/);
  return parts.length < 2 ? name : `${parts[0][0]}. ${parts.slice(1).join(' ')}`;
};

/**
 * A player name for tight spots (leaderboards, scoreboards): on phones a long name becomes "S. Brandson", so a
 * truncation can't cut the surname ("Sherman Bra…"). Wider screens and short names show the full name. Screen readers
 * always get the full name.
 */
const FitName = ({ name }: { name: string }) =>
  name.length < LONG ? (
    <>{name}</>
  ) : (
    <>
      <span className="sm:hidden" aria-hidden="true" title={name}>
        {surnameFirst(name)}
      </span>
      <span className="max-sm:sr-only">{name}</span>
    </>
  );

export default FitName;
