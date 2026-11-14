export const OFFLINE_COPY = Object.freeze({
    help: `变量 3.0 离线制卡工具（Node.js 18+）

node state3.cjs init <新目录>
node state3.cjs schema
node state3.cjs check <目录或卡文件或规则包>
node state3.cjs try <目录或卡文件或规则包> <操作.json> [--state 状态.json] [--prepared 准备数据.json] [--opening 序号] [--stage before|after]
node state3.cjs pack <目录> <原卡.json或.png> <新卡.json或.png>
node state3.cjs unpack <卡.json或.png> <新目录>

目录以 variables/definition.json 为入口。输出位置必须尚不存在。
check 检查规则及全部开局；try 返回试算状态，不执行联网工具、准备或提交后脚本。
结果为 JSON，成功退出码 0，失败退出码 1。`,
    arguments: '命令或参数有误，请使用 --help 查看用法。',
    card: '需要包含 data.extensions 的 Character Card V2/V3 JSON 或 PNG 角色卡。',
    png: 'PNG 数据损坏或缺少角色卡信息。',
    output: '输出扩展名须与原卡一致，使用 .json 或 .png。',
    file: '规则目录中存在无法打包的文件；源码文件名须符合公开格式。',
    exists: '输出位置已存在，请选择新位置，原文件保持不变。',
    stage: 'stage 须为 before 或 after。',
    opening: 'opening 须为从 0 开始的非负整数。',
});
