// Dice are a host fact, so they are rolled here once per settlement and passed to close_week.
// Twenty dice cover the most rolls a week can use (three full rooms of four).
return { dice: Array.from({ length: 20 }, () => Math.floor(Math.random() * 6) + 1) };
