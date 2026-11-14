// Rooms are derived from where members are, so membership is stored once: on the member.
// The pair relation is the game's core matching rule; the panel and both models read it from here.
([members]) => {
  const relation = (a, b) => {
    if (a.is.some(tag => b.hates.includes(tag)) || b.is.some(tag => a.hates.includes(tag))) return '冲突';
    if (a.is.includes(b.wants) && b.is.includes(a.wants)) return '相融';
    if (a.wants === b.wants) return '同类';
    return '平淡';
  };
  const rooms = {};
  for (const room of ['一号室', '二号室', '三号室']) {
    const names = Object.keys(members).filter(name => members[name].status === '在读' && members[name].room === room);
    const pairs = [];
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) pairs.push({ a: names[i], b: names[j], relation: relation(members[names[i]], members[names[j]]) });
    }
    rooms[room] = { members: names, open: names.length >= 3, pairs };
  }
  return rooms;
}
