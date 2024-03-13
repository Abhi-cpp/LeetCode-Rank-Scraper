// puppeteer-extra is a drop-in replacement for puppeteer,
// it augments the installed puppeteer with plugin functionality.
// Any number of plugins can be added through `puppeteer.use()`

const puppeteer = require('puppeteer-extra')
var UserAgent = require('user-agents');

/* `const contest = process.argv[2];` is retrieving the value of the second command line argument
provided when running the script. This allows the user to specify the contest name as an argument
when executing the script. If no argument is provided, the script will output a message asking the
user to provide the contest name and then exit. */
const contest = process.argv[2];

if (!contest) {
    console.log("Please provide the contest name. i.e. weekly-contest-388");
    process.exit(1);
}

// Add stealth plugin and use defaults (all tricks to hide puppeteer usage)
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
puppeteer.use(StealthPlugin())

// open a csv file and write the data
const fs = require('fs');
const ws = fs.createWriteStream(`ranks-for-${contest}.csv`);

let flag = false;


/**
 * The function uses Puppeteer to scrape data from a website, specifically from multiple pages of a
 * contest ranking, while handling user agents and avoiding being blocked.
 */
async function helper() {
    // launch the browser (headless mode is recommended)
    const browser = await puppeteer.launch({
        headless: true,
    });
    const page = await browser.newPage();
    let userAgent = new UserAgent();
    await page.setUserAgent(userAgent.random().toString())
    let current = 1;
    let total = 1;
    await page.goto(`https://leetcode.com/contest/${contest}/ranking/${current}/`, { waitUntil: 'networkidle2' })
    await page.waitForSelector("#contest-app > div > div > div.ranking-table-container__mOYm > div.table-responsive > table");

    let res = await page.evaluate(() => {
        return document.querySelector("#contest-app > div > div > nav > ul > li:nth-child(6) >a") ? document.querySelector("#contest-app > div > div > nav > ul > li:nth-child(6) >a").innerText : undefined
    })

    // cnt of no of pages
    console.log(res);
    if (res) {
        total = parseInt(res)
    }

    let pages = await browser.pages()

    for (let page of pages)
        await page.close()

    let cnt = 1;
    for (let i = 1; i <= total; i += 10) {
        let promises = []
        for (let j = i; j < Math.min(total, i + 10); j++) {
            const p = await browser.newPage();
            userAgent = new UserAgent();
            await page.setUserAgent(userAgent.random().toString())
            promises.push(p.goto(`https://leetcode.com/contest/${contest}/ranking/${j}/`, { waitUntil: 'networkidle2' }))
        }

        await Promise.all(promises);
        pages = await browser.pages()
        for (let page of pages) {
            await scrap(page, cnt)
            cnt++;
            page.close()
            // waste some time to avoid getting blocked or captcha
            await new Promise((resolve) => {
                setTimeout(resolve, 500);
            });
            if (flag)
                break;
        }
        if (flag)
            break;

        // waste some time to avoid getting blocked or captcha
        await new Promise((resolve) => {
            setTimeout(resolve, 3000);
        });
    }


    await browser.close()
}
helper()


/**
 * The function scrap asynchronously scrapes data from a table on a webpage and writes it to a file,
 * handling errors along the way.
 * @param page - The `page` parameter in the `scrap` function is likely referring to a web page or a
 * webpage object. This parameter is used to interact with the webpage, extract data from it, and
 * perform operations like evaluating JavaScript code within the context of the page.
 * @param idx - The `idx` parameter in the `scrap` function is used to indicate the index of the page
 * being scraped. It is used to keep track of the page number or position in the scraping process.
 * @returns The `scrap` function is returning nothing explicitly. It is a function that performs web
 * scraping on a given page and writes the extracted data to a file stream (`ws`). The function handles
 * the scraping logic, error handling, and writing data to the file stream, but it does not have an
 * explicit return value.
 */

async function scrap(page, idx) {
    try {
        let ranks = await page.evaluate(() => {
            let table = document.querySelector("#contest-app > div > div > div.ranking-table-container__mOYm > div.table-responsive > table")
            let arr = []
            for (let row of table.rows) {
                let ar = []
                for (let cell of row.cells) {
                    let val = cell.innerText;
                    ar.push(val)
                }
                arr.push(ar)
            }
            return arr;
        })
        if (idx == 1) {
            ws.write(ranks[0].join(",") + "\n");
        }
        ranks.shift();
        if (ranks[0][2] == 0) {
            flag = true;
            return;
        }
        console.log(`scraping page ${idx}... and ranks size is ${ranks.length}`);

        for (let rank of ranks) {
            ws.write(rank.join(",") + "\n");
        }

    } catch (e) {
        console.log(e.message);
    }
}
