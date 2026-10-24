const MAX_MESSAGE_LENGTH = 5000;

const rules = [
  {
    id: "urgency",
    title: "Urgent or threatening language",
    detail: "Pressure to act immediately can make it harder to verify a request.",
    weight: 20,
    patterns: [
      /\b(?:act|respond|verify|update)\s+(?:immediately|now|today)\b/i,
      /\b(?:urgent|immediate action|required)\b/i,
      /\b(?:account|service)\s+(?:will be|has been)\s+(?:suspended|closed|blocked)\b/i,
      /\bwithin\s+\d+\s+hours?\b/i
    ]
  },
  {
    id: "credentials",
    title: "Credential or verification request",
    detail: "The message asks for credentials, a one-time code, or account verification.",
    weight: 25,
    patterns: [
      /\b(?:password|passcode|one[- ]time code|verification code|otp)\b/i,
      /\b(?:confirm|verify|validate)\s+(?:your\s+)?(?:identity|account|login|credentials)\b/i,
      /\bclick\s+(?:here|the link)\s+to\s+(?:sign in|log in|verify)\b/i
    ]
  },
  {
    id: "financial",
    title: "Payment or financial pressure",
    detail: "Unexpected payment, refund, or banking instructions should be verified independently.",
    weight: 20,
    patterns: [
      /\b(?:wire|transfer|send)\s+(?:the\s+)?(?:money|funds|payment)\b/i,
      /\bsend\s+(?:the\s+)?payment\b/i,
      /\b(?:payment|invoice|refund)\s+(?:is\s+)?(?:overdue|pending|failed|waiting)\b/i,
      /\b(?:bank account|credit card|gift card|crypto(?:currency)?)\b/i
    ]
  },
  {
    id: "reward",
    title: "Unexpected prize or reward",
    detail: "Unexpected winnings or prizes are commonly used to prompt unsafe clicks.",
    weight: 14,
    patterns: [
      /\b(?:you(?:'ve| have)?\s+won|winner|claim\s+your\s+(?:prize|reward)|free\s+gift)\b/i
    ]
  },
  {
    id: "sensitive-attachment",
    title: "Unexpected attachment",
    detail: "Unexpected files can contain harmful content or lead to credential theft.",
    weight: 12,
    patterns: [
      /\b(?:open|download|enable macros for)\s+(?:the\s+)?(?:attached|attachment|document|file)\b/i
    ]
  }
];

const shortenedHosts = new Set([
  "bit.ly",
  "tinyurl.com",
  "t.co",
  "goo.gl",
  "ow.ly",
  "is.gd",
  "buff.ly",
  "rebrand.ly"
]);

function findUrls(message) {
  return message.match(/\b(?:https?:\/\/|www\.)[^\s<>"']+/gi) ?? [];
}

function inspectUrl(rawUrl) {
  const cleanedUrl = rawUrl.replace(/[),.;!?]+$/g, "");
  const normalizedUrl = cleanedUrl.toLowerCase().startsWith("www.")
    ? `https://${cleanedUrl}`
    : cleanedUrl;

  let parsedUrl;
  try {
    parsedUrl = new URL(normalizedUrl);
  } catch {
    return {
      id: "malformed-link",
      title: "Unusual link format",
      detail: "A link could not be read as a standard web address.",
      weight: 20
    };
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  if (hostname.includes("xn--")) {
    return {
      id: "lookalike-domain",
      title: "Internationalized domain name",
      detail: "This link uses a domain format that can disguise lookalike characters.",
      weight: 25
    };
  }

  if (/^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostname)) {
    return {
      id: "ip-link",
      title: "Link uses an IP address",
      detail: "The destination is an IP address rather than a recognizable domain.",
      weight: 25
    };
  }

  if ([...shortenedHosts].some((host) => hostname === host || hostname.endsWith(`.${host}`))) {
    return {
      id: "shortened-link",
      title: "Shortened link",
      detail: "The final destination is hidden behind a link-shortening service.",
      weight: 18
    };
  }

  if (parsedUrl.protocol !== "https:") {
    return {
      id: "insecure-link",
      title: "Link does not use HTTPS",
      detail: "The link does not use an encrypted HTTPS connection.",
      weight: 8
    };
  }

  return null;
}

export function analyzeMessage(message) {
  if (typeof message !== "string") {
    throw new TypeError("Message must be a string.");
  }

  const normalizedMessage = message.trim();
  if (!normalizedMessage) {
    throw new RangeError("Enter a message to scan.");
  }
  if (normalizedMessage.length > MAX_MESSAGE_LENGTH) {
    throw new RangeError(`Messages must be ${MAX_MESSAGE_LENGTH} characters or fewer.`);
  }

  const indicators = [];
  for (const rule of rules) {
    if (rule.patterns.some((pattern) => pattern.test(normalizedMessage))) {
      indicators.push({
        id: rule.id,
        title: rule.title,
        detail: rule.detail,
        weight: rule.weight
      });
    }
  }

  const urls = findUrls(normalizedMessage);
  const linkIndicatorIds = new Set();
  for (const url of urls) {
    const indicator = inspectUrl(url);
    if (indicator && !linkIndicatorIds.has(indicator.id)) {
      indicators.push(indicator);
      linkIndicatorIds.add(indicator.id);
    }
  }

  const score = Math.min(100, indicators.reduce((total, indicator) => total + indicator.weight, 0));
  const riskLevel = score >= 70 ? "critical" : score >= 45 ? "high" : score >= 20 ? "medium" : "low";
  const summary = {
    low: "No strong warning signs were found. Stay alert with unexpected requests.",
    medium: "Some warning signs were found. Verify the sender before taking action.",
    high: "Several warning signs were found. Do not use links or contact details in this message.",
    critical: "Multiple strong warning signs were found. Do not respond, open attachments, or follow links."
  }[riskLevel];

  return {
    score,
    riskLevel,
    summary,
    indicators: indicators.map(({ id, title, detail }) => ({ id, title, detail })),
    checkedLinks: urls.length,
    scannedCharacters: normalizedMessage.length,
    scannerMode: "rules-based"
  };
}

export const messageLimits = Object.freeze({
  maxCharacters: MAX_MESSAGE_LENGTH
});
