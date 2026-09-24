# GraphQL pinnedItems response -> Projects folder items: name, url, description and meta (short labels)
[.data.user.pinnedItems.nodes[] | {
  name, url, description: (.description // ""),
  meta: [.primaryLanguage.name // empty]
}]
