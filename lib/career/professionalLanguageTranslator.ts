const PHRASE_MAP: Array<[RegExp, string]> = [
  [/helped with stock/gi, "Retail inventory coordination and stock management support"],
  [/know computers/gi, "Digital literacy and productivity software familiarity"],
  [/customer service/gi, "Customer support and client communication"],
  [/worked with people/gi, "Client-facing communication and collaboration"],
  [/did admin/gi, "Administrative coordination and workflow support"],
]

export function translateToProfessionalLanguage(text: string): string {
  let output = text.trim()

  for (const [pattern, replacement] of PHRASE_MAP) {
    output = output.replace(pattern, replacement)
  }

  return output
}

export function translateBullets(bullets: string[]): string[] {
  return bullets.map((bullet) => translateToProfessionalLanguage(bullet))
}
