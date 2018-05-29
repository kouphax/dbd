const _ = require('underscore')
const moment = require('moment')

function boardgame(play) {
    return play.game.id
}


const refdata = {
    daysOfWeekName: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    monthsName: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
}

function playsForGrouping(plays, grouping) {
    return _.chain(plays)
        .groupBy(grouping)
        .value()
}

class Statistician {


    static hIndex(plays) {
        return (_.chain(plays)
            .groupBy(boardgame)
            .mapObject(_.size)
            .values()
            .reduce((memo, count) => {
                for(let i = 0; i < count; i++) {
                    memo[i] = memo[i] || []
                    memo[i].push(i + 1)
                }

                return memo
            }, [])
            .reverse()
            .find(p => p.length >= p[0])
            .value() || [0])[0]
    }

    static playCountPerDayOfWeek(plays) {
        const results = _.mapObject(playsForGrouping(plays, play => moment(play.date).format('dddd')), _.size)
        return _.map(refdata.daysOfWeekName, day => [day, results[day] || 0])
    }

    static playCountPerMonth(plays) {
        const results = _.mapObject(playsForGrouping(plays, play => moment(play.date).format('MMMM')), _.size)
        return _.map(refdata.monthsName, day => [day, results[day] || 0])
    }

    static playCountPerDay(plays) {
        return _.chain(playsForGrouping(plays, play => play.date))
            .mapObject(_.size)
            .sort()
            .reverse()
            .pairs()
            .value()
    }

    static longestPlayerWinStreak(plays, player) {
        return this.longestPlayerStreak(plays, player, play => {
            return _.any(play.players, p => p.name === player && p.win)
        })
    }

    static longestPlayerLossStreak(plays, player) {
        return this.longestPlayerStreak(plays, player, play => {
            return _.any(play.players, p => p.name === player && !p.win)
        })
    }

    static weightedWinCount(plays) {
        return _.chain(plays)
            .map(play => play.players)
            .flatten()
            .reduce((memo, player) => {
                memo[player.name] = memo[player.name] || 0
                memo[player.name] = memo[player.name] + (player.win ? 1 : -1)
                return memo
            }, {})
            .pairs()
            .sortBy(p => -p[1])
            .value()
    }

    static winsVsLoses(plays, playerName) {
        const wvl =  _.chain(plays)
            .map(play => play.players)
            .flatten()
            .filter(player => player.name === playerName)
            .countBy(play => play.win ? 'win' : 'loss')
            .value()

        return Object.assign({}, wvl, { winPct: Math.round((wvl.win/(wvl.win + wvl.loss))*100) })
    }

    static elo(plays) {
        const playerStats =  _.chain(plays)
            .map(play => play.players)
            .flatten()
            .groupBy(player => player.name)
            .mapObject((playerPlays, name) => {
                const wins = _.filter(playerPlays, play => play.win).length
                const loses = _.filter(playerPlays, play => !play.win).length
                return {
                    wins, loses, name,
                    winPct: (wins/(wins + loses)) * 100
                }
            })
            .values()
            .value()
        const avgWinPctForAllPlayers = _.reduce(playerStats, (m,p) => m + p.winPct, 0) / _.size(playerStats)

        return _.chain(playerStats)
            .map(stats => [stats.name,  (stats.wins + 32 * avgWinPctForAllPlayers) / (stats.wins + stats.loses + 32)])
            .sortBy(p => p[1])
            .value()
    }

    static champion(plays, playerName) {
        const champ = _.chain(plays)
            .groupBy(play => play.game.id)
            .pairs()
            .reject(plays => Statistician.isCooperative(plays[1]))
            .object()
            .mapObject(boardgamePlays => {
                const winCount = this.weightedWinCount(boardgamePlays)
                return winCount[0][0]
            })
            .pairs()
            .filter(champions => champions[1] === playerName)
            .map(champions => champions[0])
            .value()

        return champ
    }

    static rivalries(plays, currentUser) {

        const scoreboard = _.chain(plays)
            .filter(play => _.any(play.players, player => player.name === currentUser))
            .map(p => p.players)
            .flatten()
            .groupBy(p => p.name)
            .mapObject(_.constant(0))
            .value()

        delete(scoreboard[currentUser])
        delete(scoreboard["Anonymous player"])

        return _.chain(plays)
            .map(p => p.players)
            .reduce((memo, players) => {
                const everyoneWon = _.every(players, player => player.win)
                const everyoneLost = _.every(players, player => !player.win)
                const playerPlayed = _.find(players, player => player.name === currentUser)

                if(everyoneLost || everyoneWon || !playerPlayed){
                    return memo
                } else {
                    return _.mapObject(memo, (score, playerName) => {
                        const playerPlayed = _.find(players, player => player.name === playerName)
                        const iWon = _.any(players, player => player.name === currentUser && player.win)
                        if(playerPlayed) {
                            const playerWon = playerPlayed.win
                            if(playerWon && !iWon) {
                                return score - 1
                            } else if(iWon && !playerWon) {
                                return score + 1
                            } else {
                                return score
                            }
                        } else {
                            return score
                        }
                    })
                }
            }, scoreboard)
            .pairs()
            .sortBy(b => -b[1])
            .value()
    }

    static newGameCount(plays, currentUser) {
        function isNewToCurrentUser(player) {
            return player.name === currentUser && player.firstTimePlaying
        }

        return _.chain(plays)
            .filter(play => _.any(play.players, isNewToCurrentUser))
            .map(boardgame)
            .size()
            .value()
    }

    static playerCount(plays) {
        return _.chain(plays)
            .map(p => p.players.length)
            .groupBy(p => "" + p + " Players")
            .mapObject(p => p.length)
            .pairs()
            .sortBy(b => -b[1])
            .value()
    }

    static playCountByPlayer(plays, currentUser) {
        return _.chain(plays)
            .map(play => play.players)
            .flatten(true)
            .groupBy(p => p.name === currentUser ? p.name + " (You)" : p.name)
            .mapObject(p => p.length)
            .pairs()
            .sortBy(b => -b[1])
            .value()
    }

    static winCountByPlayer(plays) {
        return _.chain(plays)
            .map(play => play.players)
            .flatten(true)
            .filter(player => player.win)
            .groupBy(p => p.name)
            .mapObject(p => p.length)
            .pairs()
            .sortBy(b => -b[1])
            .value()
    }

    static gameCount(plays) {
        return _.uniq(plays, false, play => play.game.name).length
    }

    static playCount(plays) {
        return plays.length
    }

    static playCountByGame(plays) {
        return _.chain(plays)
            .groupBy(boardgame)
            .mapObject(_.size)
            .pairs()
            .sortBy(b => -b[1])
            .value()
    }

    // --- util --------------------------------------------------------------------------------------------------------
    static played(plays, playerName) {
        return _.chain(plays)
            .filter(play => _.any(play.players, player => player.name === playerName))
            .value()
    }

    static boardgame(plays, boardgame) {
        return _.chain(plays)
            .filter(play => play.game.id === boardgame.id)
            .value()
    }

    static players(plays) {
        return _.chain(plays)
            .map(play => {
                return _.map(play.players, player => {
                    return {id: player.name.toLowerCase(), name: player.name}
                })
            })
            .flatten()
            .uniq(player => player.id)
            .value()
    }


    static longestPlayerStreak(plays, player, streakPredicate) {
        return _.chain(this.played(plays, player))
            .sortBy(play => play.date)
            .reduce((memo, play) => {
                const success = streakPredicate(play)
                if(success) {
                    memo.current = memo.current + 1
                    if(memo.current >= memo.max) {
                        memo.max = memo.current
                    }
                } else {
                    memo.current = 0
                }

                return memo
            }, { max: 0, current: 0 })
            .value()
            .max
    }

    static boardgames(plays) {
        return _.chain(plays)
            .groupBy(play => play.game.id)
            .mapObject(plays => {
                const cooperative = Statistician.isCooperative(plays)
                return Object.assign({}, plays[0].game, { cooperative })
            })
            .values()
            .value()
    }

    // --- util --------------------------------------------------------------------------------------------------------

    static isCooperative(plays) {
        return _.every(plays, play => {
            const everyoneWon = _.every(play.players, player => player.win)
            const everyoneLost = _.every(play.players, player => !player.win)
            return everyoneWon || everyoneLost
        })
    }
    static period(plays) {
        const dates = _.chain(plays).pluck('date').sort().value()
        return {
            from: _.first(dates),
            to: _.last(dates)
        }
    }

    static report(atrributes, plays, playerName) {
        return _.chain(atrributes)
            .map(attribute => [attribute, this[attribute](plays, playerName)])
            .object()
            .value()
    }
}


module.exports = Statistician