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
