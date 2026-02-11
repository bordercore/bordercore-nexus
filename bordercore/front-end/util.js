/**
 * Trigger an animate.css animation on demand via JavaScript.
 * @param {object} node the DOM element to animate
 * @param {string} animation the animaton to use
 * @param {string} prefix the class prefix
 */
export const animateCSS = (node, animation, prefix = "animate__") =>
// We create a Promise and return it
new Promise((resolve, reject) => {
    const animationName = `${prefix}${animation}`;
    node.classList.add(`${prefix}animated`, animationName);

    // When the animation ends, we clean the classes and resolve the Promise
    function handleAnimationEnd(event) {
        event.stopPropagation();
        node.classList.remove(`${prefix}animated`, animationName);
        resolve("Animation ended");
    }

    node.addEventListener("animationend", handleAnimationEnd, {once: true});
});

/**
 * Surround substring with bold markup
 * @param {string} optionName the string
 * @param {string} substring the substring
 * @return {string} the transformed string
 */
export function boldenOption(optionName, substring) {
    if (!optionName) {
        return "";
    }
    if (!substring) {
        return optionName;
    }
    const texts = substring.split(/[\s-_/\\|\.]/gm).filter((t) => !!t) || [""];
    return optionName.replace(new RegExp("(.*?)(" + texts.join("|") + ")(.*?)", "gi"), "$1<b>$2</b>$3");
};
