const Statistician = require("./Statistician")
const BggApi = require("./BggApi")
const moment = require('moment')
const fs = require('fs');
const util = require('util');
const _ = require('underscore')
const rm = require('rmdir-recursive')
const Handlebars = require('handlebars')
const yaml = require('js-yaml');


function report(plays, period) {
    return {
        period: period,
        raw: plays,
        plays: Statistician.report([
            "playCountByGame",
            "playCountByPlayer",
            "playerCount",
            "playCount",
            "gameCount",
            "hIndex",
            "playCountPerDayOfWeek",
            "playCountPerMonth",
            "playCountPerDay",
            "weightedWinCount"
        ], plays),
        players: _.chain(Statistician.players(plays))
            .map(player => {
                const playerName = player.name
                const played = Statistician.played(plays, playerName)
                const report = Statistician.report([
                    "playCountByGame",
                    "playerCount",
                    "playCount",
                    "newGameCount",
                    "gameCount",
                    "rivalries",
                    "longestPlayerWinStreak",
                    "longestPlayerLossStreak",
                    "hIndex",
                    "playCountPerDayOfWeek",
                    "playCountPerMonth",
                    "playCountPerDay",
                    "winsVsLoses"
                ], played, playerName)
                // this is stuff that needs the ENTIRE data set relevant to the user
                const annex = Statistician.report(["champion"], plays, playerName)
                return [ playerName, Object.assign({}, report, annex) ]
            })
            .object()
            .value(),
        boardgames: _.chain(Statistician.boardgames(plays))
            .map(boardgame => {
                const gameplays = Statistician.boardgame(plays, boardgame)
                const report = Statistician.report([
                    "playerCount",
                    "playCount",
                    "playCountByPlayer",
                    "playCountPerDayOfWeek",
                    "playCountPerMonth",
                    "playCountPerDay",
                    "winCountByPlayer",
                    "period",
                    "weightedWinCount"
                ], gameplays)
                return [ boardgame.id, report ]
            })
            .object()
            .value()
    }
}

function render(template, data) {
    const cache = {}
    render = function(template, data) {
        cache[template] = cache[template] || Handlebars.compile(fs.readFileSync(`./resources/${template}.mustache`, { encoding: "utf8"}))
        return cache[template](data)
    }
    return render(template, data)
}

function byPeriod(plays, periodFormat) {
    return _.groupBy(plays, play => moment(play.date).format(periodFormat))
}

function dump(stuff) {
    console.log(util.inspect(stuff, false, null))
    //fs.writeFileSync('dump.json', JSON.stringify(stuff))
}

class App {
    static async main(username) {

        const api = new BggApi()
        const user = await api.user(username)
        const plays = await api.plays(username)

        //fs.writeFileSync('plays.json', JSON.stringify(plays))

        //const plays = JSON.parse(fs.readFileSync('plays.json')) // IF WE WANNA READ FROM THE FILE

        const stats = {
            overall: report(plays, "*"),
            periods: _.mapObject({
                "daily": byPeriod(plays, moment.HTML5_FMT.DATE),
                "weekly": byPeriod(plays, moment.HTML5_FMT.WEEK),
                "monthly": byPeriod(plays, moment.HTML5_FMT.MONTH),
                "yearly": byPeriod(plays, "YYYY"),
            }, groups => {
                return _.mapObject(groups, report)
            })
        }

        const boardgames = Statistician.boardgames(plays)
        const players = Statistician.players(plays)

        // dump(boardgames)

        Handlebars.registerHelper('boardgameName', function(id) {
            return _.find(boardgames, game => ("" + game.id) === id).name
        });

        Handlebars.registerHelper('playerId', function(name) {
            return name.toLowerCase()
        });

        rm.rmdirRecursiveSync('../content/play')

        fs.mkdirSync('../content/play')

        _.each(plays, play => {
            fs.writeFileSync(`../content/play/${play.id}.md`, JSON.stringify(play, null, 2) + "\n")
        })

        fs.closeSync(fs.openSync('../content/play/_index.md', 'w'));





        // _.each(["daily", "weekly", "monthly", "yearly"], i => {
        //     fs.mkdirSync(`./build/${username}/${i}`)
        //     for(let entry in stats.periods[i]) if(stats.periods[i].hasOwnProperty(entry)) {
        //         fs.writeFileSync(`./build/${username}/${i}/${entry}.json`, JSON.stringify(stats.periods[i][entry]))
        //         fs.writeFileSync(`./build/${username}/${i}/${entry}.html`, reportTemplate(stats.periods[i][entry]))
        //     }
        // })

        // fs.writeFileSync(`./build/index.json`, JSON.stringify(stats))
        // fs.writeFileSync(`./build/overall.json`, JSON.stringify(stats.overall))

        // const challengesConfig = yaml.safeLoad(fs.readFileSync('./resources/challenges.yml', 'utf8'));
        // const challenges = _.chain(challengesConfig)
        //     // project data for processing
        //     .map(challenge => {
        //          return Object.assign({}, challenge, {
        //              plays: _.chain(plays)
        //                  // filter by period
        //                  .filter(play => {
        //                      if(challenge.period) {
        //                          return moment(play.date).isBetween(moment(challenge.period.from), moment(challenge.period.to), "day")
        //                      } else {
        //                          return true
        //                      }
        //                  })
        //                  // filter by game
        //                  .filter(play =>  {
        //                      if(challenge.boardgames) {
        //                          const explicitlyIncluded = challenge.boardgames.include && _.any(challenge.boardgames.include, g => g.id === play.game.id)
        //                          const notExcluded = challenge.boardgames.exclude && !_.any(challenge.boardgames.exclude, g => g.id === play.game.id)
        //                          return explicitlyIncluded || notExcluded
        //                      } else {
        //                          return true
        //                      }
        //                  })
        //                  // filter by players
        //                  .filter(play => {
        //                      const playerNames = _.map(play.players, player => player.name)
        //                      if(challenge.players) {
        //                          if(challenge.players.any) {
        //                             return _.any(challenge.players.any, player => _.contains(playerNames, player))
        //                          } else if(challenge.players.all) {
        //                             return _.all(challenge.players.all, player => _.contains(playerNames, player))
        //                          } else if(challenge.players.only) {
        //                             return _.isEmpty(_.difference(playerNames, challenge.players.only))
        //                          }
        //                      } else {
        //                          return true
        //                      }
        //                  })
        //                 .value()
        //          })
        //     })
        //     .map(challenge => {
        //         if(challenge.type === 'play-x-games-y-times') {
        //             // todo currently assumes that include is the only
        //             // feature we support and that this list includes all
        //             // games we want to include
        //             return _.chain(challenge)
        //                 .map(c => {
        //                     return Object.assign({}, c, {
        //                         results: _.chain(challenge.boardgames.include)
        //                             .map(inclusion => {
        //                                 return Object.assign({}, inclusion, {
        //                                     count:  _.chain(challenge.plays)
        //                                         .filter(play => play.game.id === inclusion.id)
        //                                         .size()
        //                                         .value()
        //                                 })
        //                             })
        //                             .map(p => [p.id, p.count])
        //                             .sortBy(p => -p[1])
        //                             .value()
        //                     })
        //                 })
        //                 .map(c => {
        //                     const complete = c.targets.games * c.targets.times
        //                     const current = _.foldl(c.results, (memo, bg) => memo + bg[1], 0)
        //                     return Object.assign({}, c, {
        //                         completePct: _.chain(c.results)
        //                     })
        //                 })
        //                 .value()
        //         } else if(challenge.type === 'x-plays') {
        //             // todo currently assumes all games are included so
        //             // in future we can have include and exclude built in
        //             return Object.assign({}, challenge,  {
        //                 results: _.size(challenge.plays)
        //             })
        //
        //         } else {
        //             throw `unknown challenge type ${challenge.type}`
        //         }
        //     })
        //     .value()
        //
        //
        // function write(root, report, challenges) {
        //
        //     report = report || {}
        //
        //     try { fs.mkdirSync(`./build${root}`) } catch(e) {}
        //     try { fs.mkdirSync(`./build${root}game`) } catch(e) {}
        //     try { fs.mkdirSync(`./build${root}player`) } catch(e) {}
        //
        //     fs.writeFileSync(`./build${root}index.html`, render("report", Object.assign({}, report, { challenges })))
        //     fs.writeFileSync(`./build${root}plays.html`, render("plays",  report))
        //     fs.writeFileSync(`./build${root}games.html`, render("games",  report))
        //
        //     _.mapObject(report.boardgames || {}, (report, id) => {
        //         const boardgame = _.find(boardgames, game => ("" + game.id) === id)
        //         fs.writeFileSync(`./build${root}game/${id}.html`, render("game", { id, report, boardgame }))
        //     })
        //
        //     _.mapObject(report.players | {}, (report, name) => {
        //         const player = _.find(players, player => player.name === name)
        //         fs.writeFileSync(`./build${root}player/${player.id}.html`, render("player", { id: player.id, report, player }))
        //     })
        // }
        //
        // write("/", stats.overall, challenges)
        // write("/monthly/", stats.periods.monthly[moment().format(moment.HTML5_FMT.MONTH)])
        // write("/weekly/", stats.periods.weekly[moment().format(moment.HTML5_FMT.WEEK)] || report([],moment().format(moment.HTML5_FMT.WEEK)))
        // write("/yearly/", stats.periods.yearly[moment().format("YYYY")])
        //


        // achievements
        // gaming groups

    }
}

module.exports = App
