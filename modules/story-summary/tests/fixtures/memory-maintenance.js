export function maintenanceFixture() {
    const chat = Array.from({ length: 24 }, (_, index) => ({
        is_user: index % 2 === 0, name: index % 2 === 0 ? '旅人' : '叙述者', mes: '两人继续整理旅途记录。',
    }));
    chat[0].mes = '夏实为什么被回收？';
    chat[1].mes = '夏实说：“听说我可能因为看到了机密，所以才会被回收吧。我也没有确证。”';
    chat[2].mes = '这把药箱是谁的？';
    chat[3].mes = '药君把自己的药箱交给夏实暂时保管，说：“这是我的，你替我拿一下。”';
    chat[4].mes = '离开长沙以后，你们到哪里了？';
    chat[5].mes = '我们上个月住长沙，昨天已抵达北京，准备在北京长期生活。';
    chat[6].mes = '夏实离开客房了吗？';
    chat[7].mes = '夏实刚从客房走到船上的餐厅，点了一杯茶。这只是午餐时的小移动。';
    chat[8].mes = '你答应保留那本书吗？';
    chat[9].mes = '夏实答应保存旅人赠送的旧书，直到明年秋天再一起重读。';
    chat[10].mes = '回忆上个月另一座山发生的争吵。';
    chat[11].mes = '上个月，夏实和旅人在青山因为一张船票吵架；雨停后各自回家。那一次与今天的寻找失物无关。';
    chat[16].mes = '今天我们在红山顶寻找遗失的项链。';
    chat[17].mes = '夏实误会旅人故意丢掉项链，两人在红山顶争吵。枯叶的焦味在空气里弥漫。';
    chat[18].mes = '我没丢掉，是绳子断了。';
    chat[19].mes = '夏实气得转身。旅人想说请别走，却说不出口。两人仍在红山顶，项链尚未找到。';
    chat[20].mes = '等一下，我看见石缝里反光了。';
    chat[21].mes = '旅人从红山顶的石缝找回断绳项链。夏实确认是自己误会，低声道歉。';
    chat[22].mes = '我们一起修好，别再分开找了。夏实点头，两人修好项链，约好一起下红山，这次争吵终于和解。';
    chat[23].mes = '夏实和旅人因为刚刚的和解，决定次日共同启程。';
    const event = (id, title, summary, addedAt, causedBy = []) => ({ id, title, summary, _addedAt: addedAt,
        timeLabel: '今天', participants: ['夏实', '旅人'], causedBy, memoryRole: '具体经历' });
    const json = {
        events: [
            event('evt-1', '红山争吵', '找项链时发生误会；枯叶焦味里，旅人没能说出挽留，项链尚未找到。(#17-20)', 19),
            event('evt-2', '找回项链并和解', '石缝找到断绳项链，夏实道歉；一起修好并约定下山。(#21-23)', 23),
            event('evt-3', '青山船票争吵', '上个月在青山为船票争吵，雨停后各自回家。(#11-12)', 19),
            event('evt-4', '共同启程', '两人因和解决定次日共同启程。(#24)', 23, ['evt-2']),
        ],
        facts: [
            { id: 'f-1', s: '夏实', p: '回收原因', o: '看到了机密', since: 1, _addedAt: 19 },
            { id: 'f-2', s: '夏实', p: '物品', o: '拥有药箱', since: 3, _addedAt: 19 },
            { id: 'f-3', s: '旅人', p: '现居城市', o: '长沙', since: 5, _addedAt: 19 },
            { id: 'f-4', s: '夏实', p: '当前位置', o: '客房', since: 7, _addedAt: 19 },
            { id: 'f-5', s: '夏实', p: '承诺', o: '保存旧书直到明年秋天一起重读', since: 9, _addedAt: 19 },
        ],
        characters: { main: [{ name: '夏实', _addedAt: 19 }, { name: '旅人', _addedAt: 19 }, { name: '药君', _addedAt: 19 }] },
        arcs: [], keywords: [], characterAliases: [],
    };
    const atom = (floor, semantic, edges) => ({ atomId: `atom-${floor}-0`, floor, source: 'ai', semantic, edges, where: '', quality: 0.8 });
    const atoms = [
        atom(1, '夏实确认自己因为看到了机密而被回收。', [{ s: '夏实', t: '机密', r: '看到了' }]),
        atom(3, '夏实将自己的药箱交给药君暂时保管。', [{ s: '夏实', t: '药君', r: '交出自己的药箱' }]),
        atom(5, '旅人昨天到达长沙，打算在长沙长期生活。', [{ s: '旅人', t: '长沙', r: '准备长期居住' }]),
        atom(7, '夏实从客房走到船上的餐厅，点了一杯茶。', [{ s: '夏实', t: '茶', r: '点了一杯' }]),
    ];
    const l0Index = { version: 1, byFloor: Object.fromEntries(atoms.map(item => [item.floor, { floor: item.floor, status: 'ok', atoms: 1 }])) };
    return { chatId: 'maintenance-fixture', chat, json, atoms, l0Index, cutoff: 23, start: 0 };
}

export const joinedEventPatch = {
    summary: '两人在红山顶寻找项链时误会争吵；枯叶焦味中旅人没说出挽留。随后石缝找到断绳项链，夏实道歉，两人修好项链约定下山。(#17-23)',
};
