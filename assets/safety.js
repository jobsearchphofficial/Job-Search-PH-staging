// Spots chat messages that look like common job scams: asking for money or fees, one-time codes,
// ID or account numbers, or links to unknown sites. Shared by the chat page (warnings) and
// scripts/send-emails.mjs (flags the chat for an admin). English, Tagalog and Hiligaynon words.
// It's a safety net, not proof: an admin decides.

const RULES = [
  { type: "money", label: "asks for money or a payment app",
    re: /\b(g-?cash|pay ?maya|maya|palawan( express)?|cebuana|m ?lhuillier|western union|remittance|padala|magpadala|ipadala|send (me )?(money|the payment|payment)|bank transfer|transfer (the )?money|deposit|down ?payment|cash ?in)\b/i },
  { type: "fee", label: "mentions a fee or paying to get the job",
    re: /\b((processing|placement|training|medical|registration|reservation|application|uniform|id|agency|seminar|orientation|booking)\s*fees?|bayad\s*(sa|para sa)\s*(training|medical|processing|placement|requirements|uniform|id|seminar)|kailangan\s*(mo\s*)?(mag)?bayad|pay (first|upfront|in advance)|advance payment)\b/i },
  { type: "otp", label: "asks for a one-time code (OTP)",
    re: /\b(otp|one[- ]time (pin|password|code)|verification code|6[- ]digit code|code (na|nga) (gin)?padala|i-?send (mo )?(ang|the) code)\b/i },
  { type: "id", label: "shares or asks for ID or account numbers",
    re: /\b(sss|tin|philhealth|pag-?ibig|umid|passport|driver'?s license|account|card|atm|bank)\s*(no\.?|number|#)|\bpin (code|number)\b|\bcvv\b/i },
  { type: "link", label: "has a link to an unknown website",
    re: /(https?:\/\/|www\.)(?!(www\.|m\.)?(jobsearchph\.com|facebook\.com|fb\.com|m\.me|messenger\.com|google\.com\/maps|maps\.app\.goo\.gl|goo\.gl\/maps))[^\s]+|\b(bit\.ly|tinyurl\.com|t\.co|cutt\.ly|shorturl\.at)\/\S+/i },
];

// Returns [{ type, label }] for each kind of risk found (empty if none).
export function scamFlags(text) {
  const t = String(text || "");
  if (!t.trim()) return [];
  // "no fee", "walang bayad", "free" next to the fee words means the opposite: don't flag those.
  const safe = t.replace(/\b(no|walang|wala(ng)?|without|free of|libre(ng)?|hindi (kailangan|need)|never|don'?t|do not)\b[^.!?\n]{0,30}\b(fees?|bayad|payment|deposit)\b/gi, " ");
  return RULES.filter((r) => r.re.test(safe)).map(({ type, label }) => ({ type, label }));
}

// Kinds that matter most when an employer sends them to a jobseeker.
export const SERIOUS = ["money", "fee", "otp"];
