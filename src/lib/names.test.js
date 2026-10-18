import { describe, it, expect } from 'vitest'
import { nameOptions, canAddNew, addName, resolveName, globalNames } from './names.js'
import { SEED_NAMES } from './seed.js'

const names = { Self: ['Others', 'Swiggy', 'Uber', 'Food'], Home: ['Milk', 'Swiggy', 'Gold'] }
const e = (category, spend_name) => ({ category, spend_name })

describe('name picker ordering', () => {
  it('puts names used in the category first, most used first, then the category list, then the global rest', () => {
    const entries = [e('Self', 'Uber'), e('Self', 'Uber'), e('Self', 'Food'), e('Home', 'Gold'), e('Home', 'Gold'), e('Home', 'Gold')]
    expect(nameOptions('Self', entries, names)).toEqual(['Uber', 'Food', 'Others', 'Swiggy', 'Milk', 'Gold'])
  })
  it('falls back to the seed order when nothing was used yet', () => {
    expect(nameOptions('Home', [], names)).toEqual(['Milk', 'Swiggy', 'Gold', 'Others', 'Uber', 'Food'])
  })
  it('counts spelling variants as one name and shows the list spelling', () => {
    const r = nameOptions('Self', [e('Self', 'swiggy'), e('Self', 'SWIGGY')], names)
    expect(r[0]).toBe('Swiggy')
    expect(r.filter((n) => n.toLowerCase() === 'swiggy')).toHaveLength(1)
  })
  it('filters by search text and keeps the order', () => {
    expect(nameOptions('Self', [e('Self', 'Uber')], names, 'ub')).toEqual(['Uber'])
    expect(nameOptions('Self', [], names, 'GO')).toEqual(['Gold'])
  })
})

describe('add new and duplicates', () => {
  const opts = nameOptions('Self', [], names)
  it('offers Add new only for text that matches nothing', () => {
    expect(canAddNew('', opts)).toBe(false)
    expect(canAddNew('   ', opts)).toBe(false)
    expect(canAddNew('swiggy', opts)).toBe(false)
    expect(canAddNew('Cab', opts)).toBe(true)
  })
  it('resolves typed text to the existing spelling, trimmed', () => {
    expect(resolveName('  swiggy ', globalNames(names))).toBe('Swiggy')
    expect(resolveName(' New one ', globalNames(names))).toBe('New one')
  })
  it('adds a new name to the category list once', () => {
    const r = addName(names, 'Self', '  Cab  ')
    expect(r.name).toBe('Cab')
    expect(r.names.Self).toEqual([...names.Self, 'Cab'])
    expect(addName(r.names, 'Self', 'cab').names.Self.filter((n) => n === 'Cab')).toHaveLength(1)
  })
  it('a name that exists in another category is added to this one with the existing spelling', () => {
    const r = addName(names, 'Self', 'gold')
    expect(r.name).toBe('Gold')
    expect(r.names.Self).toContain('Gold')
  })
  it('ignores empty text', () => {
    expect(addName(names, 'Self', '  ').name).toBe('')
  })
})

describe('seed', () => {
  it('has the five categories and neutral family names', () => {
    expect(Object.keys(SEED_NAMES)).toEqual(['Self', 'Home', 'Travel', 'Savings', 'Office'])
    expect(SEED_NAMES.Savings).toHaveLength(7)
    expect(globalNames(SEED_NAMES)).toEqual(expect.arrayContaining(['Family 1', 'Family 2', 'Family 3']))
  })
})
