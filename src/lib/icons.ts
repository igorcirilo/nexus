// src/lib/icons.ts
//
// Fonte única dos nomes de ícone do Nexus (desenhados em components/ui/Icon.tsx).
// O app deixou de usar emoji como ícone de interface: tudo passa pelo <Icon>.
//
// Alguns dados antigos guardados no banco ainda trazem emoji (ícone do hábito,
// emoji de categoria personalizada em Finanças). `resolveIcon` converte esses
// valores na leitura para o ícone mais próximo, sem precisar de migration.

export const ICON_NAMES = [
  // originais
  'zap', 'target', 'clipboard', 'flame', 'dumbbell', 'salad', 'scale', 'calendar',
  'check', 'bell', 'list', 'trend-up', 'trend-down', 'plus', 'chevron-left',
  'chevron-right', 'chevron-down', 'x', 'coffee', 'utensils', 'cup', 'moon', 'sunrise', 'sun',
  'clock', 'trophy',
  // navegação e ações
  'arrow-right', 'arrow-left', 'arrow-up', 'arrow-down', 'undo', 'repeat',
  'search', 'pencil', 'trash', 'pin', 'upload', 'download', 'file-text', 'lock',
  'camera', 'bookmark', 'eye', 'eye-off', 'check-circle', 'compass',
  // estado
  'info', 'alert-triangle', 'alert-circle', 'lightbulb', 'ban',
  // finanças
  'wallet', 'piggy-bank', 'landmark', 'banknote', 'credit-card', 'receipt',
  'bar-chart', 'hourglass', 'shield', 'tag', 'gift', 'briefcase', 'package',
  'cart', 'car', 'bus', 'plane', 'home', 'building', 'droplet', 'smartphone',
  'laptop', 'pill', 'heart', 'heart-pulse', 'gamepad', 'film', 'music', 'book',
  'book-open', 'graduation-cap', 'shirt', 'scissors', 'paw', 'wrench', 'sprout',
  'tv', 'settings', 'fuel',
  // pessoas e áreas
  'users', 'message', 'leaf', 'brain', 'activity', 'bed', 'snowflake', 'gem',
  'mountain', 'medal', 'phone', 'mail', 'tree', 'wind', 'notebook',
  // humor (check-in)
  'mood-1', 'mood-2', 'mood-3', 'mood-4',
] as const

export type IconName = (typeof ICON_NAMES)[number]

const NAME_SET: ReadonlySet<string> = new Set(ICON_NAMES)

export function isIconName(v: unknown): v is IconName {
  return typeof v === 'string' && NAME_SET.has(v)
}

// Emoji legado → ícone. Cobre os emojis que o app já gravou ou ofereceu.
const EMOJI_TO_ICON: Record<string, IconName> = {
  '📦': 'package', '🛒': 'cart', '🍔': 'utensils', '☕': 'coffee', '🍺': 'cup',
  '🍕': 'utensils', '🍽': 'utensils', '🍱': 'utensils', '🥗': 'salad', '🍎': 'salad',
  '🚗': 'car', '⛽': 'fuel', '🚌': 'bus', '✈': 'plane', '🏠': 'home', '🛋': 'home',
  '🏘': 'building', '💡': 'lightbulb', '💧': 'droplet', '🔥': 'flame', '📱': 'smartphone',
  '💊': 'pill', '🏥': 'heart-pulse', '🦷': 'heart-pulse', '💪': 'dumbbell', '🏋': 'dumbbell',
  '⚽': 'activity', '🎮': 'gamepad', '🎬': 'film', '📺': 'tv', '🎵': 'music', '🎸': 'music',
  '🎧': 'music', '📚': 'book', '📖': 'book-open', '📓': 'notebook', '🗒': 'notebook',
  '🎓': 'graduation-cap', '👕': 'shirt', '👟': 'shirt', '💄': 'scissors', '✂': 'scissors',
  '🐶': 'paw', '🐱': 'paw', '🎁': 'gift', '💳': 'credit-card', '🏦': 'landmark',
  '📈': 'trend-up', '💹': 'trend-up', '📉': 'trend-down', '🔧': 'wrench', '🛠': 'wrench',
  '🧾': 'receipt', '🌱': 'sprout', '🍼': 'heart', '🚬': 'ban', '🚭': 'ban', '🚫': 'ban',
  '🧳': 'briefcase', '💼': 'briefcase', '⚙': 'settings', '❤': 'heart', '💌': 'mail',
  '🛡': 'shield', '🔮': 'hourglass', '💰': 'wallet', '🐖': 'piggy-bank', '💸': 'banknote',
  '💻': 'laptop', '👨‍💻': 'laptop', '📊': 'bar-chart', '🎯': 'target', '⚡': 'zap',
  '🏆': 'trophy', '🌅': 'sunrise', '☀': 'sun', '🌙': 'moon', '😴': 'bed', '💤': 'bed',
  '🛏': 'bed', '📅': 'calendar', '📆': 'calendar', '🔔': 'bell', '✅': 'check-circle',
  '🔁': 'repeat', '🔄': 'repeat', '📌': 'pin', '🏷': 'tag', '🤝': 'users', '👪': 'users',
  '🫂': 'users', '🎉': 'users', '🗣': 'message', '💬': 'message', '🗨': 'message',
  '📞': 'phone', '🧘': 'leaf', '🌬': 'wind', '🌳': 'tree', '🧠': 'brain', '🚶': 'activity',
  '🏃': 'activity', '🤸': 'activity', '🚿': 'droplet', '🧴': 'droplet', '🪥': 'droplet',
  '🪜': 'activity', '⚖': 'scale', '🍅': 'clock', '📥': 'list', '🧹': 'home', '📵': 'ban',
  '📄': 'file-text', '🚀': 'trend-up', '✍': 'pencil', '✏': 'pencil', '🙏': 'heart',
  '🪞': 'eye', '🌟': 'heart', '🤲': 'heart', '💎': 'gem', '🏔': 'mountain', '🧊': 'snowflake',
  '🎖': 'medal', '🏅': 'medal', '🧭': 'compass', '🔒': 'lock', '🔖': 'bookmark',
}

/** Converte um valor guardado (nome de ícone ou emoji antigo) num IconName. */
export function resolveIcon(value: string | null | undefined, fallback: IconName = 'package'): IconName {
  if (!value) return fallback
  if (isIconName(value)) return value
  // Remove o seletor de variação (U+FE0F) e o modificador de pele.
  const clean = value.replace(/[️\u{1F3FB}-\u{1F3FF}]/gu, '').trim()
  return EMOJI_TO_ICON[clean] ?? EMOJI_TO_ICON[[...clean][0] ?? ''] ?? fallback
}

/** Ícones oferecidos ao criar uma categoria personalizada em Finanças. */
export const CATEGORY_ICON_CHOICES: IconName[] = [
  'package', 'cart', 'utensils', 'coffee', 'cup', 'car', 'fuel', 'bus', 'plane',
  'home', 'building', 'lightbulb', 'droplet', 'flame', 'smartphone', 'laptop', 'tv',
  'pill', 'heart-pulse', 'dumbbell', 'activity', 'gamepad', 'film', 'music', 'book',
  'graduation-cap', 'shirt', 'scissors', 'paw', 'gift', 'credit-card', 'landmark',
  'trend-up', 'wrench', 'receipt', 'sprout', 'briefcase', 'settings', 'heart',
]
