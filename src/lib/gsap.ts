import { gsap } from "gsap"
import { Draggable } from "gsap/Draggable"
import { Flip } from "gsap/Flip"
import { InertiaPlugin } from "gsap/InertiaPlugin"
import { Observer } from "gsap/Observer"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { SplitText } from "gsap/SplitText"

gsap.registerPlugin(Flip, Draggable, InertiaPlugin, Observer, ScrollTrigger, SplitText)

export { Draggable, Flip, gsap, InertiaPlugin, Observer, ScrollTrigger, SplitText }
