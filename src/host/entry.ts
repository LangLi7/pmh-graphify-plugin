/**
 * **Einstieg der Host-Hälfte.**
 *
 * Der Provider (`./index.ts`) bringt die Routen mit; hier kommt das
 * `Config`-Schema des Eintrags dazu — daraus speist sich die
 * Einstellungsseite im Plugin-Manager.
 *
 * @module dsh-plugin-graphify/host
 */

import z from '@deepseek-ai/schemastery'

export { apply, inject, name, default } from './index.ts'

/**
 * Die Anzeige des Panels.
 *
 * Die Werte werden im Browser gelesen (`ctx.configForms.get('pmh-graphify')`);
 * der Host hält sie nur. Ein Feld ohne Wirkung gibt es hier nicht.
 */
export const Config = z.object({
  /** Wo das Panel erscheint: Seitenleiste, Plugin-Liste, beides oder nirgends. */
  surface: z
    .union([z.const('sidebar'), z.const('plugins'), z.const('both'), z.const('none')])
    .default('sidebar')
    .description('sidebar · plugins · both · none'),
  /** Platz in der Leiste bzw. Liste; kleinere Zahl steht weiter oben. */
  order: z.natural().max(999).default(12).description('Platz in der Liste, kleinere Zahl zuerst'),
  /** Eigene Beschriftung; leer heißt: Text aus dem Sprachpaket. */
  label: z.string().default('').description('leer = Beschriftung aus dem Sprachpaket'),
  /** Welche Flächen aufgehen: Liste, Graph und Knotendaten. */
  view: z
    .union([z.const('split'), z.const('graph'), z.const('list')])
    .default('split')
    .description('split · graph · list — welche Flächen aufgehen'),
  /** Die Ebene beim Öffnen. */
  level: z
    .union([z.const('gesamt'), z.const('gruppe'), z.const('nachbarschaft')])
    .default('gesamt')
    .description('gesamt · gruppe · nachbarschaft — die Ebene beim Öffnen'),
  /** Schritte der Nachbarschaft. */
  depth: z.natural().min(1).max(3).default(2).description('Nachbarschaft um den Knoten: 1 bis 3'),
  /** Höchstzahl gezeichneter Knoten. */
  limit: z.natural().min(20).max(400).default(160).description('Höchstzahl gezeichneter Knoten: 20 bis 400'),
  /** Namen an den Knoten. */
  labels: z.boolean().default(true).description('Namen an den Knoten zeichnen'),
  /** Farbe nach Gruppe oder nach Art. */
  colour: z
    .union([z.const('community'), z.const('kind')])
    .default('community')
    .description('community · kind — Farbe nach Gruppe oder nach Art'),
  /** Layout beim Öffnen und Ziehen weiterrechnen. */
  motion: z.boolean().default(true).description('Layout beim Öffnen und Ziehen weiterrechnen'),
  /** Wohin die Knotendaten kommen. */
  inspector: z
    .union([z.const('right'), z.const('below'), z.const('off')])
    .default('right')
    .description('right · below · off — wohin die Knotendaten kommen'),
})
