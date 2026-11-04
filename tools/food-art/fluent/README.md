Fluent Emoji 3D pieces (MIT, github.com/microsoft/fluentui-emoji) used inside
composite icons. Fetch more with:
  https://cdn.jsdelivr.net/gh/microsoft/fluentui-emoji@main/assets/<Name%20with%20spaces>/3D/<snake_name>_3d.png

pizza_cheese.png is pizza.png with the pepperoni recoloured to cheese:
  magick pizza.png \( -clone 0 -modulate 114,95,132 \) \( -clone 0 -colorspace HSL -fx "(u.r>0.86 || u.r<0.015) && u.g>0.5 && u.b>0.45 ? 1 : 0" -channel R -separate +channel -blur 0x1.5 \) -compose over -composite pizza_cheese.png
