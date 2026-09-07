export interface KnownPerson { name: string; aliases: string[]; text: string }

const nameKey = (name: string) => name.trim().normalize('NFKC').toLocaleLowerCase();

/** People offered for selection come from known characters, never from chat/card titles. */
export function selectKnownPeople(people: readonly KnownPerson[], playerName: string): KnownPerson[] {
    const player = nameKey(playerName);
    return people
        .filter(person => !player || ![person.name, ...person.aliases].some(name => nameKey(name) === player))
        .slice(0, 200)
        .map(person => ({ ...person, aliases: [...person.aliases], text: '' }));
}
