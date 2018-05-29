const _ = require('underscore')

class BggApi {
    constructor() {
        this.client = require('bgg')({
            timeout: 10000,
            retry: {
                initial: 100,
                multiplier: 2,
                max: 15e3
            }
        })
    }

    async user(username) {
        return await this.client('user', { name: username })
            .then(user => user.user.id !== "" ? user.user : null)
    }

    async plays(username) {
        const pageSize = 100
        const playsPage1 = await this.client('plays', { username, page: 1, pageSize: 100 })
        const total = playsPage1.plays.total
        const pages = Math.ceil(total/pageSize)
        var plays = playsPage1.plays.play

        for(var page = 2; page <= pages; page++) {
            var pageOfPlays = await this.client('plays', { username, page: page, pageSize: 100 })
            plays = plays.concat(pageOfPlays.plays.play)
        }

        return _.chain(plays)
            .map(play => _.pick(play, "id", "date", "location", "item", "players"))
            .map(play => {
                play.game = {
                    name: play.item.name,
                    id: play.item.objectid
                }

                delete play.item
                return play
            })
            .map(play => {
                play.players = _.flatten([play.players.player])
                play.players = _.map(play.players, player => {
                    return {
                        username: player.username,
                        userid: player.userid,
                        name: player.name,
                        score: player.score,
                        firstTimePlaying: player.new === 1,
                        win: player.win === 1
                    }
                })
                return play
            })
            .value()
    }
}

module.exports = BggApi
