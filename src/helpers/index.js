module.exports = async (className, headless, log) => {
    return await className.build(className, headless, log)
}