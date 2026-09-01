// 本机上传记录（localStorage）：宾客再次扫码进来可看到自己历史上传及状态

const KEY = 'wedding-upload-records'
const MAX = 200

export function getRecords() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || []
  } catch {
    return []
  }
}

export function saveRecords(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(-MAX)))
  } catch {
    // 存储已满等情况静默忽略
  }
}

/** 追加一条记录，返回最新列表 */
export function addRecord(record) {
  const list = getRecords()
  list.push(record)
  saveRecords(list)
  return list
}

/** 按文件名移除记录（宾客撤回后本地同步清理），返回最新列表 */
export function removeRecord(name) {
  const list = getRecords().filter((r) => r.name !== name)
  saveRecords(list)
  return list
}
