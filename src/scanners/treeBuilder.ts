import { compareStrings } from "../core/paths.js";
import type { FileFact, TreeNode } from "./types.js";

/**
 * Fold a sorted list of file facts into a hierarchical tree.
 * Directory nodes are inferred from path segments.
 *
 * Determinism: input is expected pre-sorted by path (POSIX, compareStrings).
 * Children are emitted in sorted order at every level.
 */
export function buildTree(files: FileFact[], rootName: string): TreeNode {
  const root: TreeNode = {
    name: rootName,
    path: "",
    type: "dir",
    children: [],
  };

  // Map from full dir path → node, so we can attach children quickly.
  const dirs = new Map<string, TreeNode>();
  dirs.set("", root);

  for (const file of files) {
    const segments = file.path.split("/");
    const fileName = segments[segments.length - 1]!;
    const dirSegments = segments.slice(0, -1);

    let parentPath = "";
    let parent = root;
    for (const seg of dirSegments) {
      const childPath = parentPath === "" ? seg : `${parentPath}/${seg}`;
      let dirNode = dirs.get(childPath);
      if (!dirNode) {
        dirNode = { name: seg, path: childPath, type: "dir", children: [] };
        dirs.set(childPath, dirNode);
        parent.children!.push(dirNode);
      }
      parent = dirNode;
      parentPath = childPath;
    }

    const fileNode: TreeNode = {
      name: fileName,
      path: file.path,
      type: "file",
      lineCount: file.lineCount,
      language: file.language,
      role: file.role,
    };
    parent.children!.push(fileNode);
  }

  // Final sort: directories first, then files, alphabetical within each.
  sortNode(root);
  return root;
}

function sortNode(node: TreeNode): void {
  if (!node.children) return;
  node.children.sort((a, b) => {
    if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
    return compareStrings(a.name, b.name);
  });
  for (const child of node.children) {
    if (child.type === "dir") sortNode(child);
  }
}
