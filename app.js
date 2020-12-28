import cheerioModule from "cheerio";
import config from "./config.js";
import {get} from "./apiClient.js";
import getCsv from "get-csv"
import fs from 'fs'

const acceptableCodes = []
const arkData = []
const arkShortcodeLookup = {
    'ARKK': 'ARK_INNOVATION_ETF_ARKK_HOLDINGS',
    'ARKG': 'ARK_GENOMIC_REVOLUTION_MULTISECTOR_ETF_ARKG_HOLDINGS',
    'ARKQ':'ARK_AUTONOMOUS_TECHNOLOGY_&_ROBOTICS_ETF_ARKQ_HOLDINGS',
    'ARKW':'ARK_NEXT_GENERATION_INTERNET_ETF_ARKW_HOLDINGS',
    'ARKF': 'ARK_FINTECH_INNOVATION_ETF_ARKF_HOLDINGS'
}
const arkUrl = `https://ark-funds.com/wp-content/fundsiteliterature/csv/${arkShortcodeLookup[config.arkCode]}.csv`
const alternativeTickers = {
    'RHHBY': 'ROG'
}
const blacklist = [
    'DSY'
]

async function getTrading212Stocks() {
    const html = await get(config.t212Url)
    const $ = cheerioModule.load(html);
    const codes = $('#all-equities > .js-search-row');
    codes.each(function() {
        const isFractional = parseFloat($(this).find('div:nth-child(5)').text()) < 1
        const marketName = $(this).find('[data-label="Market name"]').text()
        const isAllowedInIsa = !marketName.includes('OTC Markets') && !marketName.includes('NON-ISA')
        if(isFractional && isAllowedInIsa) {
            const company = $(this).find('[data-label="Company"]').text()
            const ticker = $(this).find('[data-label="Instrument"]').text()
            acceptableCodes.push({ticker: ticker, company: company})
        }
    })
}

async function getArkStocks() {
    await Promise.resolve(getCsv(arkUrl)
        .then(rows => {
            const tickersAndWeights = []
            rows.forEach(row => {
                if(row.ticker && row["weight(%)"] && row.company) {
                    tickersAndWeights.push({ticker: row.ticker.split(" ")[0], weight: parseFloat(row["weight(%)"]), company: row.company})
                }
            })

            return tickersAndWeights
        })
        .then(tickers => tickers.forEach(ticker => arkData.push(ticker))))
}

const siftStocks = () => {
    const tickersOnly = acceptableCodes.map(code => code.ticker)
    const matched = arkData.filter(data => tickersOnly.includes(data.ticker) && !blacklist.includes(data.ticker))
    const alternatives = []
    for(const [key, value] of Object.entries(alternativeTickers)) {
        const alternative = arkData.filter(data => data.ticker === key)
        if(alternative && alternative.length) {
            alternative[0].ticker = value
            alternatives.push(alternative[0])
        }
    }

    return matched.concat(alternatives)
}

const weightStocks = (siftedStocks) => {
    if(siftedStocks.length === arkData.length) {
        return siftedStocks
    }
    const totalWeights = siftedStocks.map(stock => stock.weight)
        .reduce((a, b) => a + b, 0)
    const missingWeight = 100.0 - totalWeights
    const weightToAddPerStock = missingWeight / siftedStocks.length
    siftedStocks.forEach(stock => stock.weight = parseFloat((stock.weight + weightToAddPerStock).toFixed(1)))
    return siftedStocks
}

const diffOldAndNew = (oldStocks, newStocks) => {
    const removed = oldStocks.filter(old => !newStocks.map(s => s.ticker).includes(old.ticker))
    const updated = newStocks.filter(n => {
        const oldStock = oldStocks.filter(o => o.ticker === n.ticker)
        if(oldStock.length) {
            return oldStock[0].weight !== n.weight
        }
        return false
    })
    const newAdditions = newStocks.filter(n => !oldStocks.map(s => s.ticker).includes(n.ticker))
    return [newAdditions, updated, removed]
}

const printResults = (args) => {
    const newAdditions = args.newAdditions
    const updated = args.updated
    const removed = args.removed

    if(newAdditions && newAdditions.length) {
        console.log("========================")
        console.log('NEW STOCKS ADDED TO ETF')
        newAdditions.forEach(n => {
            console.log("-----")
            console.log(`Ticker: ${n.ticker}. Company: ${n.company}. Weight: ${n.weight}`)
        })
        console.log("========================")
    }
    if(updated && updated.length) {
        console.log("========================")
        console.log('UPDATED WEIGHTS')
        updated.forEach(n => {
            console.log("-----")
            console.log(`Ticker: ${n.ticker}. Company: ${n.company}. Weight: ${n.weight}`)
        })
        console.log("========================")
    }
    if(removed && removed.length) {
        console.log("========================")
        console.log('STOCKS REMOVED FROM ETF')
        removed.forEach(n => {
            console.log("-----")
            console.log(`Ticker: ${n.ticker}. Company: ${n.company}. Weight: ${n.weight}`)
        })
        console.log("========================")
    }

}

(async () => {
    const filename = `${config.arkCode}.json`
    var historicData
    if (fs.existsSync(filename)) {
        let rawdata = fs.readFileSync(filename);
        historicData = JSON.parse(rawdata);
    }
    await Promise.all([
        getArkStocks(),
        getTrading212Stocks()]
    )
    const siftedStocks = siftStocks()
    const weightedStocks = weightStocks(siftedStocks)
    if(historicData) {
        const [newAdditions, updated, removed] = diffOldAndNew(historicData, weightedStocks)
        printResults({newAdditions: newAdditions, updated: updated, removed: removed})
    } else {
        printResults({newAdditions: weightedStocks})
    }
    fs.writeFileSync(filename, JSON.stringify(weightedStocks, null ,2))
})()
