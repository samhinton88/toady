const puppeteer = require('puppeteer');

class PageProxy {
  static async build(Pageclass, headless=false, log) {

    const browser = await puppeteer.launch({
      headless,
      args: [
        '--window-position=0,0',
        '--window-size=1000,900'
      ]
    });

    const context = await browser.createIncognitoBrowserContext();

    const puppeteerPage = await context.newPage();

    await puppeteerPage.setViewport({ width: 1000, height: 900 });

    const myPage = new Pageclass(puppeteerPage, log);

    return new Proxy(myPage, {
      get(_, prop) {
        return myPage[prop] || browser[prop] || puppeteerPage[prop] 
      }
    })
  }

  constructor(page, log) {
    this.page = page;
    this.logger = log;
  }

  end() {
    console.log('END OF SEQUENCE');
  }

  newInstance(command) {
    this.log(`[newInstance] with command: ${command}`);
    return command
  }

  timeStamp() {
    const time = new Date();
    const mils = time.getMilliseconds();
    const secs = time.getSeconds();
    const mins = time.getMinutes();
    const hours = time.getHours();
    return `${hours}:${mins}:${secs}.${mils}`; 
  }

  async log(message) {
    const timeStamp = this.timeStamp();

    console.log(`${timeStamp} [${this.constructor.name}]: ${message}`)
    
    if(this.logger) {
      this.logger.emit('log', `${timeStamp} [${this.constructor.name}]: ${message}`)
    }
  }

  async awaitAndClick(selector) {
    await this.log(`[awaitAndClick] ${selector}`);
    await this.page.waitFor(selector);
    await this.page.click(selector);
  }

  async awaitAndType(selector, string) {
    await this.log(`[awaitAndType] ${string} to ${selector}`);

    await this.page.waitFor(selector);
    await this.page.type(selector, string);
  }

  async clearCookies() {
    const cookies = await this.page.cookies();

    this.log(`delete cookies ${cookies}`)

    await this.page.deleteCookie(...cookies);
  }
}

module.exports = PageProxy;