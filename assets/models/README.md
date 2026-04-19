# 3D Models (GLB)

Drop hero and enemy GLB files here (e.g. from Meshy.ai, Kenney, Mixamo, or Sketchfab).

- **hero_mage.glb** – Hero character; used in `Hero.tscn` as the `Model` node (placeholder capsule is hidden).

## Animations and Meshy

**Meshy.ai (and most GLB exports) do not include animations** – they export a static mesh and materials only. So the wizard does not “come with” idle/run/attack from the file.

The game uses **code-generated fallback animations** in `Hero.gd` (`_build_fallback_animations()`): when the Hero loads, it creates an `AnimationPlayer` and adds simple clips (idle, run, attack, cast) that move/scale the `Model` node. So you should still see:
- a small **bounce** when moving (run),
- a **scale punch** when attacking (LMB),
- a **scale pulse** when casting (Q).

If you still see no motion, the AnimationPlayer may not be targeting the right node (e.g. if the GLB root is named differently). For custom skeletal animations you’d need a GLB from a tool that exports them (e.g. Mixamo, or a rigged model with an AnimationPlayer and clips named `idle`, `run`, `attack`, `cast`).
