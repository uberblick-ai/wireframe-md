```wireframe[980x700]
screen lookbook title="Lookbook" device=browser width=1366 height=820 surface=plain url="https://wireframe.md/lookbook"
  split axis=vertical sizes="auto,rest" surface=plain
    region label="Top Bar" surface=plain placeholder=false
    split axis=horizontal sizes="260,rest" surface=plain
      region label="Sidebar" surface=plain show_label=false
        tree
          group label="Layout"
            item label="Screen"
            item label="Frame"
            item label="Split"
            item label="Region"
          group label="Navigation"
            item label="Tree" selected=true
            item label="Group"
            item label="Item"
      split axis=vertical sizes="rest,220"
        region label="Preview"
        split axis=horizontal sizes="280,rest"
          region label="Params"
            props
              prop key="device" value="browser"
              prop key="surface" value="plain"
              prop key="url" value="https://wireframe.md/lookbook"
          region label="Markdown"
            code_block language="wireframe"
              code_line "screen lookbook title=\"Lookbook\" device=browser surface=plain"
              code_line "  split axis=vertical sizes=\"auto,rest\" surface=plain"
```
