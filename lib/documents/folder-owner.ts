import type { DocumentFolderNode } from '@/services/account'

/**
 * Whose folder is this? The Document Library lists a folder in "My Drive" with `owner_id = me`, which is right for a folder of my own and wrong for a SHARED one: a folder with no owner
 * (an organisation folder, such as the "Sales Kit" folder the Sales Kit makes) or somebody else's folder that is visible to me holds documents that other people own and that I may open,
 * and the owner filter hid every one of them, so the folder looked empty. The server already limits the answer to documents the caller may see, so inside such a folder the owner filter is
 * simply left off.
 *
 * The root (null) and a folder that is not in the tree (not loaded yet) count as mine: nothing changes there.
 */
export function folderOwnedByOthers(tree: readonly DocumentFolderNode[], folderId: number | null, myId: number | null): boolean {
  if (folderId === null || folderId === 0) return false
  const find = (nodes: readonly DocumentFolderNode[]): DocumentFolderNode | null => {
    for (const node of nodes) {
      if (node.id === folderId) return node
      const inside = find(node.children ?? [])
      if (inside) return inside
    }
    return null
  }
  const folder = find(tree)
  if (folder === null) return false

  return folder.owner_id === null || folder.owner_id !== myId
}
