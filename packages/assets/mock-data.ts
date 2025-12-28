export const mockData = [
  {
    "request": {
      "method": "GET",
      "url": "https://v3.football.api-sports.io/standings",
      "headers": {
        "x-rapidapi-key": "52dd...5e7f",
        "x-rapidapi-host": "v3.football.api-sports.io"
      },
      "queryParams": {
        "league": "39",
        "season": "2024"
      }
    },
    "response": {
      "status": 200,
      "data": {
        "get": "standings",
        "parameters": {
          "league": "39",
          "season": "2024"
        },
        "errors": {
          "plan": "Free plans do not have access to this season, try from 2021 to 2023."
        },
        "results": 0,
        "paging": {
          "current": 1,
          "total": 1
        },
        "response": []
      },
      "headers": {
        "date": "Sun, 23 Nov 2025 10:53:52 GMT",
        "content-type": "application/json",
        "transfer-encoding": "chunked",
        "connection": "keep-alive",
        "server": "cloudflare",
        "vary": "Accept-Encoding",
        "access-control-allow-origin": "*",
        "access-control-allow-credentials": "True",
        "access-control-allow-methods": "GET, OPTIONS",
        "access-control-allow-headers": "x-rapidapi-key, x-apisports-key, x-rapidapi-host",
        "x-envoy-upstream-service-time": "2",
        "cache-control": "no-store, no-cache, must-revalidate",
        "pragma": "no-cache",
        "expires": "0",
        "strict-transport-security": "max-age=31536000; includeSubDomains",
        "cf-cache-status": "DYNAMIC",
        "nel": "{\"report_to\":\"cf-nel\",\"success_fraction\":0.0,\"max_age\":604800}",
        "report-to": "{\"group\":\"cf-nel\",\"max_age\":604800,\"endpoints\":[{\"url\":\"https://a.nel.cloudflare.com/report/v4?s=LG0XgSfOy8pKIuNlyri%2FEkT5MMIycAW2o3%2BwoKfUz260mW8HAAB%2BDpoCmrxNcJcx0nojyYsiAear78IW0mZyNLAq8rdzeUWGMFtTV6Unn4iatXwxg0KhrA%3D%3D\"}]}",
        "cf-ray": "9a30201449ed323b-ARN"
      }
    }
  },
  {
    "request": {
      "method": "GET",
      "url": "https://v3.football.api-sports.io/standings",
      "headers": {
        "x-rapidapi-key": "52dd...5e7f",
        "x-rapidapi-host": "v3.football.api-sports.io"
      },
      "queryParams": {
        "league": "39",
        "season": "2021"
      }
    },
    "response": {
      "status": 200,
      "data": {
        "get": "standings",
        "parameters": {
          "league": "39",
          "season": "2021"
        },
        "errors": [],
        "results": 1,
        "paging": {
          "current": 1,
          "total": 1
        },
        "response": [
          {
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2021,
              "standings": [
                [
                  {
                    "rank": 1,
                    "team": {
                      "id": 50,
                      "name": "Manchester City",
                      "logo": "https://media.api-sports.io/football/teams/50.png"
                    },
                    "points": 93,
                    "goalsDiff": 73,
                    "group": "Premier League",
                    "form": "WDWWW",
                    "status": "same",
                    "description": "Promotion - Champions League (Group Stage)",
                    "all": {
                      "played": 38,
                      "win": 29,
                      "draw": 6,
                      "lose": 3,
                      "goals": {
                        "for": 99,
                        "against": 26
                      }
                    },
                    "home": {
                      "played": 19,
                      "win": 15,
                      "draw": 2,
                      "lose": 2,
                      "goals": {
                        "for": 58,
                        "against": 15
                      }
                    },
                    "away": {
                      "played": 19,
                      "win": 14,
                      "draw": 4,
                      "lose": 1,
                      "goals": {
                        "for": 41,
                        "against": 11
                      }
                    },
                    "update": "2022-05-22T00:00:00+00:00"
                  },
                  {
                    "rank": 2,
                    "team": {
                      "id": 40,
                      "name": "Liverpool",
                      "logo": "https://media.api-sports.io/football/teams/40.png"
                    },
                    "points": 92,
                    "goalsDiff": 68,
                    "group": "Premier League",
                    "form": "WWWDW",
                    "status": "same",
                    "description": "Promotion - Champions League (Group Stage)",
                    "all": {
                      "played": 38,
                      "win": 28,
                      "draw": 8,
                      "lose": 2,
                      "goals": {
                        "for": 94,
                        "against": 26
                      }
                    },
                    "home": {
                      "played": 19,
                      "win": 15,
                      "draw": 4,
                      "lose": 0,
                      "goals": {
                        "for": 49,
                        "against": 9
                      }
                    },
                    "away": {
                      "played": 19,
                      "win": 13,
                      "draw": 4,
                      "lose": 2,
                      "goals": {
                        "for": 45,
                        "against": 17
                      }
                    },
                    "update": "2022-05-22T00:00:00+00:00"
                  },
                  {
                    "rank": 3,
                    "team": {
                      "id": 49,
                      "name": "Chelsea",
                      "logo": "https://media.api-sports.io/football/teams/49.png"
                    },
                    "points": 74,
                    "goalsDiff": 43,
                    "group": "Premier League",
                    "form": "WDWDL",
                    "status": "same",
                    "description": "Promotion - Champions League (Group Stage)",
                    "all": {
                      "played": 38,
                      "win": 21,
                      "draw": 11,
                      "lose": 6,
                      "goals": {
                        "for": 76,
                        "against": 33
                      }
                    },
                    "home": {
                      "played": 19,
                      "win": 9,
                      "draw": 7,
                      "lose": 3,
                      "goals": {
                        "for": 37,
                        "against": 22
                      }
                    },
                    "away": {
                      "played": 19,
                      "win": 12,
                      "draw": 4,
                      "lose": 3,
                      "goals": {
                        "for": 39,
                        "against": 11
                      }
                    },
                    "update": "2022-05-22T00:00:00+00:00"
                  },
                  {
                    "rank": 4,
                    "team": {
                      "id": 47,
                      "name": "Tottenham",
                      "logo": "https://media.api-sports.io/football/teams/47.png"
                    },
                    "points": 71,
                    "goalsDiff": 29,
                    "group": "Premier League",
                    "form": "WWWDW",
                    "status": "same",
                    "description": "Promotion - Champions League (Group Stage)",
                    "all": {
                      "played": 38,
                      "win": 22,
                      "draw": 5,
                      "lose": 11,
                      "goals": {
                        "for": 69,
                        "against": 40
                      }
                    },
                    "home": {
                      "played": 19,
                      "win": 13,
                      "draw": 1,
                      "lose": 5,
                      "goals": {
                        "for": 38,
                        "against": 19
                      }
                    },
                    "away": {
                      "played": 19,
                      "win": 9,
                      "draw": 4,
                      "lose": 6,
                      "goals": {
                        "for": 31,
                        "against": 21
                      }
                    },
                    "update": "2022-05-22T00:00:00+00:00"
                  },
                  {
                    "rank": 5,
                    "team": {
                      "id": 42,
                      "name": "Arsenal",
                      "logo": "https://media.api-sports.io/football/teams/42.png"
                    },
                    "points": 69,
                    "goalsDiff": 13,
                    "group": "Premier League",
                    "form": "WLLWW",
                    "status": "same",
                    "description": "Promotion - Europa League (Group Stage)",
                    "all": {
                      "played": 38,
                      "win": 22,
                      "draw": 3,
                      "lose": 13,
                      "goals": {
                        "for": 61,
                        "against": 48
                      }
                    },
                    "home": {
                      "played": 19,
                      "win": 13,
                      "draw": 2,
                      "lose": 4,
                      "goals": {
                        "for": 35,
                        "against": 17
                      }
                    },
                    "away": {
                      "played": 19,
                      "win": 9,
                      "draw": 1,
                      "lose": 9,
                      "goals": {
                        "for": 26,
                        "against": 31
                      }
                    },
                    "update": "2022-05-22T00:00:00+00:00"
                  },
                  {
                    "rank": 6,
                    "team": {
                      "id": 33,
                      "name": "Manchester United",
                      "logo": "https://media.api-sports.io/football/teams/33.png"
                    },
                    "points": 58,
                    "goalsDiff": 0,
                    "group": "Premier League",
                    "form": "LLWDL",
                    "status": "same",
                    "description": "Promotion - Europa League (Group Stage)",
                    "all": {
                      "played": 38,
                      "win": 16,
                      "draw": 10,
                      "lose": 12,
                      "goals": {
                        "for": 57,
                        "against": 57
                      }
                    },
                    "home": {
                      "played": 19,
                      "win": 10,
                      "draw": 5,
                      "lose": 4,
                      "goals": {
                        "for": 32,
                        "against": 22
                      }
                    },
                    "away": {
                      "played": 19,
                      "win": 6,
                      "draw": 5,
                      "lose": 8,
                      "goals": {
                        "for": 25,
                        "against": 35
                      }
                    },
                    "update": "2022-05-22T00:00:00+00:00"
                  },
                  {
                    "rank": 7,
                    "team": {
                      "id": 48,
                      "name": "West Ham",
                      "logo": "https://media.api-sports.io/football/teams/48.png"
                    },
                    "points": 56,
                    "goalsDiff": 9,
                    "group": "Premier League",
                    "form": "LDWLL",
                    "status": "same",
                    "description": "Promotion - Europa Conference League (Qualification)",
                    "all": {
                      "played": 38,
                      "win": 16,
                      "draw": 8,
                      "lose": 14,
                      "goals": {
                        "for": 60,
                        "against": 51
                      }
                    },
                    "home": {
                      "played": 19,
                      "win": 9,
                      "draw": 5,
                      "lose": 5,
                      "goals": {
                        "for": 33,
                        "against": 26
                      }
                    },
                    "away": {
                      "played": 19,
                      "win": 7,
                      "draw": 3,
                      "lose": 9,
                      "goals": {
                        "for": 27,
                        "against": 25
                      }
                    },
                    "update": "2022-05-22T00:00:00+00:00"
                  },
                  {
                    "rank": 8,
                    "team": {
                      "id": 46,
                      "name": "Leicester",
                      "logo": "https://media.api-sports.io/football/teams/46.png"
                    },
                    "points": 52,
                    "goalsDiff": 3,
                    "group": "Premier League",
                    "form": "WDWWL",
                    "status": "same",
                    "description": undefined,
                    "all": {
                      "played": 38,
                      "win": 14,
                      "draw": 10,
                      "lose": 14,
                      "goals": {
                        "for": 62,
                        "against": 59
                      }
                    },
                    "home": {
                      "played": 19,
                      "win": 10,
                      "draw": 4,
                      "lose": 5,
                      "goals": {
                        "for": 34,
                        "against": 23
                      }
                    },
                    "away": {
                      "played": 19,
                      "win": 4,
                      "draw": 6,
                      "lose": 9,
                      "goals": {
                        "for": 28,
                        "against": 36
                      }
                    },
                    "update": "2022-05-22T00:00:00+00:00"
                  },
                  {
                    "rank": 9,
                    "team": {
                      "id": 51,
                      "name": "Brighton",
                      "logo": "https://media.api-sports.io/football/teams/51.png"
                    },
                    "points": 51,
                    "goalsDiff": -2,
                    "group": "Premier League",
                    "form": "WDWWD",
                    "status": "same",
                    "description": undefined,
                    "all": {
                      "played": 38,
                      "win": 12,
                      "draw": 15,
                      "lose": 11,
                      "goals": {
                        "for": 42,
                        "against": 44
                      }
                    },
                    "home": {
                      "played": 19,
                      "win": 5,
                      "draw": 7,
                      "lose": 7,
                      "goals": {
                        "for": 19,
                        "against": 23
                      }
                    },
                    "away": {
                      "played": 19,
                      "win": 7,
                      "draw": 8,
                      "lose": 4,
                      "goals": {
                        "for": 23,
                        "against": 21
                      }
                    },
                    "update": "2022-05-22T00:00:00+00:00"
                  },
                  {
                    "rank": 10,
                    "team": {
                      "id": 39,
                      "name": "Wolves",
                      "logo": "https://media.api-sports.io/football/teams/39.png"
                    },
                    "points": 51,
                    "goalsDiff": -5,
                    "group": "Premier League",
                    "form": "LDLDL",
                    "status": "same",
                    "description": undefined,
                    "all": {
                      "played": 38,
                      "win": 15,
                      "draw": 6,
                      "lose": 17,
                      "goals": {
                        "for": 38,
                        "against": 43
                      }
                    },
                    "home": {
                      "played": 19,
                      "win": 7,
                      "draw": 3,
                      "lose": 9,
                      "goals": {
                        "for": 20,
                        "against": 25
                      }
                    },
                    "away": {
                      "played": 19,
                      "win": 8,
                      "draw": 3,
                      "lose": 8,
                      "goals": {
                        "for": 18,
                        "against": 18
                      }
                    },
                    "update": "2022-05-22T00:00:00+00:00"
                  },
                  {
                    "rank": 11,
                    "team": {
                      "id": 34,
                      "name": "Newcastle",
                      "logo": "https://media.api-sports.io/football/teams/34.png"
                    },
                    "points": 49,
                    "goalsDiff": -18,
                    "group": "Premier League",
                    "form": "WWLLW",
                    "status": "same",
                    "description": undefined,
                    "all": {
                      "played": 38,
                      "win": 13,
                      "draw": 10,
                      "lose": 15,
                      "goals": {
                        "for": 44,
                        "against": 62
                      }
                    },
                    "home": {
                      "played": 19,
                      "win": 8,
                      "draw": 6,
                      "lose": 5,
                      "goals": {
                        "for": 26,
                        "against": 27
                      }
                    },
                    "away": {
                      "played": 19,
                      "win": 5,
                      "draw": 4,
                      "lose": 10,
                      "goals": {
                        "for": 18,
                        "against": 35
                      }
                    },
                    "update": "2022-05-22T00:00:00+00:00"
                  },
                  {
                    "rank": 12,
                    "team": {
                      "id": 52,
                      "name": "Crystal Palace",
                      "logo": "https://media.api-sports.io/football/teams/52.png"
                    },
                    "points": 48,
                    "goalsDiff": 4,
                    "group": "Premier League",
                    "form": "WLDWW",
                    "status": "same",
                    "description": undefined,
                    "all": {
                      "played": 38,
                      "win": 11,
                      "draw": 15,
                      "lose": 12,
                      "goals": {
                        "for": 50,
                        "against": 46
                      }
                    },
                    "home": {
                      "played": 19,
                      "win": 7,
                      "draw": 8,
                      "lose": 4,
                      "goals": {
                        "for": 27,
                        "against": 17
                      }
                    },
                    "away": {
                      "played": 19,
                      "win": 4,
                      "draw": 7,
                      "lose": 8,
                      "goals": {
                        "for": 23,
                        "against": 29
                      }
                    },
                    "update": "2022-05-22T00:00:00+00:00"
                  },
                  {
                    "rank": 13,
                    "team": {
                      "id": 55,
                      "name": "Brentford",
                      "logo": "https://media.api-sports.io/football/teams/55.png"
                    },
                    "points": 46,
                    "goalsDiff": -8,
                    "group": "Premier League",
                    "form": "LWWLD",
                    "status": "same",
                    "description": undefined,
                    "all": {
                      "played": 38,
                      "win": 13,
                      "draw": 7,
                      "lose": 18,
                      "goals": {
                        "for": 48,
                        "against": 56
                      }
                    },
                    "home": {
                      "played": 19,
                      "win": 7,
                      "draw": 3,
                      "lose": 9,
                      "goals": {
                        "for": 22,
                        "against": 21
                      }
                    },
                    "away": {
                      "played": 19,
                      "win": 6,
                      "draw": 4,
                      "lose": 9,
                      "goals": {
                        "for": 26,
                        "against": 35
                      }
                    },
                    "update": "2022-05-22T00:00:00+00:00"
                  },
                  {
                    "rank": 14,
                    "team": {
                      "id": 66,
                      "name": "Aston Villa",
                      "logo": "https://media.api-sports.io/football/teams/66.png"
                    },
                    "points": 45,
                    "goalsDiff": -2,
                    "group": "Premier League",
                    "form": "LDDLW",
                    "status": "same",
                    "description": undefined,
                    "all": {
                      "played": 38,
                      "win": 13,
                      "draw": 6,
                      "lose": 19,
                      "goals": {
                        "for": 52,
                        "against": 54
                      }
                    },
                    "home": {
                      "played": 19,
                      "win": 6,
                      "draw": 5,
                      "lose": 8,
                      "goals": {
                        "for": 29,
                        "against": 29
                      }
                    },
                    "away": {
                      "played": 19,
                      "win": 7,
                      "draw": 1,
                      "lose": 11,
                      "goals": {
                        "for": 23,
                        "against": 25
                      }
                    },
                    "update": "2022-05-22T00:00:00+00:00"
                  },
                  {
                    "rank": 15,
                    "team": {
                      "id": 41,
                      "name": "Southampton",
                      "logo": "https://media.api-sports.io/football/teams/41.png"
                    },
                    "points": 40,
                    "goalsDiff": -24,
                    "group": "Premier League",
                    "form": "LLLLD",
                    "status": "same",
                    "description": undefined,
                    "all": {
                      "played": 38,
                      "win": 9,
                      "draw": 13,
                      "lose": 16,
                      "goals": {
                        "for": 43,
                        "against": 67
                      }
                    },
                    "home": {
                      "played": 19,
                      "win": 6,
                      "draw": 7,
                      "lose": 6,
                      "goals": {
                        "for": 23,
                        "against": 24
                      }
                    },
                    "away": {
                      "played": 19,
                      "win": 3,
                      "draw": 6,
                      "lose": 10,
                      "goals": {
                        "for": 20,
                        "against": 43
                      }
                    },
                    "update": "2022-05-22T00:00:00+00:00"
                  },
                  {
                    "rank": 16,
                    "team": {
                      "id": 45,
                      "name": "Everton",
                      "logo": "https://media.api-sports.io/football/teams/45.png"
                    },
                    "points": 39,
                    "goalsDiff": -23,
                    "group": "Premier League",
                    "form": "LWLDW",
                    "status": "same",
                    "description": undefined,
                    "all": {
                      "played": 38,
                      "win": 11,
                      "draw": 6,
                      "lose": 21,
                      "goals": {
                        "for": 43,
                        "against": 66
                      }
                    },
                    "home": {
                      "played": 19,
                      "win": 9,
                      "draw": 2,
                      "lose": 8,
                      "goals": {
                        "for": 27,
                        "against": 25
                      }
                    },
                    "away": {
                      "played": 19,
                      "win": 2,
                      "draw": 4,
                      "lose": 13,
                      "goals": {
                        "for": 16,
                        "against": 41
                      }
                    },
                    "update": "2022-05-22T00:00:00+00:00"
                  },
                  {
                    "rank": 17,
                    "team": {
                      "id": 63,
                      "name": "Leeds",
                      "logo": "https://media.api-sports.io/football/teams/63.png"
                    },
                    "points": 38,
                    "goalsDiff": -37,
                    "group": "Premier League",
                    "form": "WDLLL",
                    "status": "same",
                    "description": undefined,
                    "all": {
                      "played": 38,
                      "win": 9,
                      "draw": 11,
                      "lose": 18,
                      "goals": {
                        "for": 42,
                        "against": 79
                      }
                    },
                    "home": {
                      "played": 19,
                      "win": 4,
                      "draw": 6,
                      "lose": 9,
                      "goals": {
                        "for": 19,
                        "against": 38
                      }
                    },
                    "away": {
                      "played": 19,
                      "win": 5,
                      "draw": 5,
                      "lose": 9,
                      "goals": {
                        "for": 23,
                        "against": 41
                      }
                    },
                    "update": "2022-05-22T00:00:00+00:00"
                  },
                  {
                    "rank": 18,
                    "team": {
                      "id": 44,
                      "name": "Burnley",
                      "logo": "https://media.api-sports.io/football/teams/44.png"
                    },
                    "points": 35,
                    "goalsDiff": -19,
                    "group": "Premier League",
                    "form": "LDLLW",
                    "status": "same",
                    "description": "Relegation - Championship",
                    "all": {
                      "played": 38,
                      "win": 7,
                      "draw": 14,
                      "lose": 17,
                      "goals": {
                        "for": 34,
                        "against": 53
                      }
                    },
                    "home": {
                      "played": 19,
                      "win": 5,
                      "draw": 6,
                      "lose": 8,
                      "goals": {
                        "for": 18,
                        "against": 25
                      }
                    },
                    "away": {
                      "played": 19,
                      "win": 2,
                      "draw": 8,
                      "lose": 9,
                      "goals": {
                        "for": 16,
                        "against": 28
                      }
                    },
                    "update": "2022-05-22T00:00:00+00:00"
                  },
                  {
                    "rank": 19,
                    "team": {
                      "id": 38,
                      "name": "Watford",
                      "logo": "https://media.api-sports.io/football/teams/38.png"
                    },
                    "points": 23,
                    "goalsDiff": -43,
                    "group": "Premier League",
                    "form": "LLDLL",
                    "status": "same",
                    "description": "Relegation - Championship",
                    "all": {
                      "played": 38,
                      "win": 6,
                      "draw": 5,
                      "lose": 27,
                      "goals": {
                        "for": 34,
                        "against": 77
                      }
                    },
                    "home": {
                      "played": 19,
                      "win": 2,
                      "draw": 2,
                      "lose": 15,
                      "goals": {
                        "for": 17,
                        "against": 46
                      }
                    },
                    "away": {
                      "played": 19,
                      "win": 4,
                      "draw": 3,
                      "lose": 12,
                      "goals": {
                        "for": 17,
                        "against": 31
                      }
                    },
                    "update": "2022-05-22T00:00:00+00:00"
                  },
                  {
                    "rank": 20,
                    "team": {
                      "id": 71,
                      "name": "Norwich",
                      "logo": "https://media.api-sports.io/football/teams/71.png"
                    },
                    "points": 22,
                    "goalsDiff": -61,
                    "group": "Premier League",
                    "form": "LDLLL",
                    "status": "same",
                    "description": "Relegation - Championship",
                    "all": {
                      "played": 38,
                      "win": 5,
                      "draw": 7,
                      "lose": 26,
                      "goals": {
                        "for": 23,
                        "against": 84
                      }
                    },
                    "home": {
                      "played": 19,
                      "win": 3,
                      "draw": 3,
                      "lose": 13,
                      "goals": {
                        "for": 12,
                        "against": 43
                      }
                    },
                    "away": {
                      "played": 19,
                      "win": 2,
                      "draw": 4,
                      "lose": 13,
                      "goals": {
                        "for": 11,
                        "against": 41
                      }
                    },
                    "update": "2022-05-22T00:00:00+00:00"
                  }
                ]
              ]
            }
          }
        ]
      },
      "headers": {
        "date": "Sun, 23 Nov 2025 10:53:59 GMT",
        "content-type": "application/json",
        "transfer-encoding": "chunked",
        "connection": "keep-alive",
        "server": "cloudflare",
        "vary": "Accept-Encoding",
        "access-control-allow-origin": "*",
        "access-control-allow-credentials": "True",
        "access-control-allow-methods": "GET, OPTIONS",
        "access-control-allow-headers": "x-rapidapi-key, x-apisports-key, x-rapidapi-host",
        "x-ratelimit-limit": "10",
        "x-ratelimit-remaining": "9",
        "x-ratelimit-requests-limit": "100",
        "x-ratelimit-requests-remaining": "90",
        "x-envoy-upstream-service-time": "7",
        "cache-control": "no-store, no-cache, must-revalidate",
        "pragma": "no-cache",
        "expires": "0",
        "strict-transport-security": "max-age=31536000; includeSubDomains",
        "cf-cache-status": "DYNAMIC",
        "nel": "{\"report_to\":\"cf-nel\",\"success_fraction\":0.0,\"max_age\":604800}",
        "report-to": "{\"group\":\"cf-nel\",\"max_age\":604800,\"endpoints\":[{\"url\":\"https://a.nel.cloudflare.com/report/v4?s=mFNircxcAcOdBmVMzEVgg2Uf1F7zbSg2O%2FeuNIVLvcv0s%2BOp%2BqHV4rrtaZ0TPjKHoEgToadMNe3E%2BoJ%2BqRLuKR4yzuzadYB0Rk6TyNGjEQaQ1eBU0818fQ%3D%3D\"}]}",
        "cf-ray": "9a30203b8accc8c4-ARN"
      }
    }
  },
  {
    "request": {
      "method": "GET",
      "url": "https://v3.football.api-sports.io/fixtures",
      "headers": {
        "x-rapidapi-key": "52dd...5e7f",
        "x-rapidapi-host": "api-football-v1.p.rapidapi.com"
      },
      "queryParams": {
        "season": "2020"
      }
    },
    "response": {
      "status": 200,
      "data": {
        "get": "fixtures",
        "parameters": {
          "season": "2020"
        },
        "errors": {
          "plan": "Free plans do not have access to this season, try from 2021 to 2023."
        },
        "results": 0,
        "paging": {
          "current": 1,
          "total": 1
        },
        "response": []
      },
      "headers": {
        "date": "Sun, 23 Nov 2025 10:54:03 GMT",
        "content-type": "application/json",
        "transfer-encoding": "chunked",
        "connection": "keep-alive",
        "server": "cloudflare",
        "vary": "Accept-Encoding",
        "access-control-allow-origin": "*",
        "access-control-allow-credentials": "True",
        "access-control-allow-methods": "GET, OPTIONS",
        "access-control-allow-headers": "x-rapidapi-key, x-apisports-key, x-rapidapi-host",
        "x-envoy-upstream-service-time": "12",
        "cache-control": "no-store, no-cache, must-revalidate",
        "pragma": "no-cache",
        "expires": "0",
        "strict-transport-security": "max-age=31536000; includeSubDomains",
        "cf-cache-status": "DYNAMIC",
        "nel": "{\"report_to\":\"cf-nel\",\"success_fraction\":0.0,\"max_age\":604800}",
        "report-to": "{\"group\":\"cf-nel\",\"max_age\":604800,\"endpoints\":[{\"url\":\"https://a.nel.cloudflare.com/report/v4?s=vMOEo0c7w%2Fav3LHFvvpHmMwVm2Pdue6yTlFM4m4rqX4%2BkNw4f7nGn9pG9mdO190G4BqNOMQmqKFciDYD493ghsV6w%2FQ8Cof8AOg%2BzVc4qiDMedXJK6yrLQ%3D%3D\"}]}",
        "cf-ray": "9a302056be0bc8c4-ARN"
      }
    }
  },
  {
    "request": {
      "method": "GET",
      "url": "https://v3.football.api-sports.io/fixtures",
      "headers": {
        "x-rapidapi-key": "52dd...5e7f",
        "x-rapidapi-host": "api-football-v1.p.rapidapi.com"
      },
      "queryParams": {
        "season": "2021",
        "team": "49"
      }
    },
    "response": {
      "status": 200,
      "data": {
        "get": "fixtures",
        "parameters": {
          "season": "2021",
          "team": "49"
        },
        "errors": [],
        "results": 70,
        "paging": {
          "current": 1,
          "total": 1
        },
        "response": [
          {
            "fixture": {
              "id": 706410,
              "referee": "S. Karasev",
              "timezone": "UTC",
              "date": "2021-08-11T19:00:00+00:00",
              "timestamp": 1628708400,
              "periods": {
                "first": 1628708400,
                "second": 1628712000
              },
              "venue": {
                "id": 1971,
                "name": "Windsor Park",
                "city": "Belfast"
              },
              "status": {
                "long": "Match Finished",
                "short": "PEN",
                "elapsed": 120,
                "extra": undefined
              }
            },
            "league": {
              "id": 531,
              "name": "UEFA Super Cup",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/531.png",
              "flag": undefined,
              "season": 2021,
              "round": "Final",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": true
              },
              "away": {
                "id": 533,
                "name": "Villarreal",
                "logo": "https://media.api-sports.io/football/teams/533.png",
                "winner": false
              }
            },
            "goals": {
              "home": 1,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 0
              },
              "fulltime": {
                "home": 1,
                "away": 1
              },
              "extratime": {
                "home": 0,
                "away": 0
              },
              "penalty": {
                "home": 6,
                "away": 5
              }
            }
          },
          {
            "fixture": {
              "id": 710558,
              "referee": "J. Moss",
              "timezone": "UTC",
              "date": "2021-08-14T14:00:00+00:00",
              "timestamp": 1628949600,
              "periods": {
                "first": 1628949600,
                "second": 1628953200
              },
              "venue": {
                "id": 519,
                "name": "Stamford Bridge",
                "city": "London"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2021,
              "round": "Regular Season - 1",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": true
              },
              "away": {
                "id": 52,
                "name": "Crystal Palace",
                "logo": "https://media.api-sports.io/football/teams/52.png",
                "winner": false
              }
            },
            "goals": {
              "home": 3,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 2,
                "away": 0
              },
              "fulltime": {
                "home": 3,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 710566,
              "referee": "P. Tierney",
              "timezone": "UTC",
              "date": "2021-08-22T15:30:00+00:00",
              "timestamp": 1629646200,
              "periods": {
                "first": 1629646200,
                "second": 1629649800
              },
              "venue": {
                "id": 494,
                "name": "Emirates Stadium",
                "city": "London"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2021,
              "round": "Regular Season - 2",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 42,
                "name": "Arsenal",
                "logo": "https://media.api-sports.io/football/teams/42.png",
                "winner": false
              },
              "away": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": true
              }
            },
            "goals": {
              "home": 0,
              "away": 2
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 2
              },
              "fulltime": {
                "home": 0,
                "away": 2
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 710579,
              "referee": "A. Taylor",
              "timezone": "UTC",
              "date": "2021-08-28T16:30:00+00:00",
              "timestamp": 1630168200,
              "periods": {
                "first": 1630168200,
                "second": 1630171800
              },
              "venue": {
                "id": 550,
                "name": "Anfield",
                "city": "Liverpool"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2021,
              "round": "Regular Season - 3",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": undefined
              },
              "away": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": undefined
              }
            },
            "goals": {
              "home": 1,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 1
              },
              "fulltime": {
                "home": 1,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 710588,
              "referee": "S. Attwell",
              "timezone": "UTC",
              "date": "2021-09-11T16:30:00+00:00",
              "timestamp": 1631377800,
              "periods": {
                "first": 1631377800,
                "second": 1631381400
              },
              "venue": {
                "id": 519,
                "name": "Stamford Bridge",
                "city": "London"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2021,
              "round": "Regular Season - 4",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": true
              },
              "away": {
                "id": 66,
                "name": "Aston Villa",
                "logo": "https://media.api-sports.io/football/teams/66.png",
                "winner": false
              }
            },
            "goals": {
              "home": 3,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 0
              },
              "fulltime": {
                "home": 3,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 710603,
              "referee": "P. Tierney",
              "timezone": "UTC",
              "date": "2021-09-19T15:30:00+00:00",
              "timestamp": 1632065400,
              "periods": {
                "first": 1632065400,
                "second": 1632069000
              },
              "venue": {
                "id": 593,
                "name": "Tottenham Hotspur Stadium",
                "city": "London"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2021,
              "round": "Regular Season - 5",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 47,
                "name": "Tottenham",
                "logo": "https://media.api-sports.io/football/teams/47.png",
                "winner": false
              },
              "away": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": true
              }
            },
            "goals": {
              "home": 0,
              "away": 3
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 0,
                "away": 3
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 710608,
              "referee": "M. Oliver",
              "timezone": "UTC",
              "date": "2021-09-25T11:30:00+00:00",
              "timestamp": 1632569400,
              "periods": {
                "first": 1632569400,
                "second": 1632573000
              },
              "venue": {
                "id": 519,
                "name": "Stamford Bridge",
                "city": "London"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2021,
              "round": "Regular Season - 6",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": false
              },
              "away": {
                "id": 50,
                "name": "Manchester City",
                "logo": "https://media.api-sports.io/football/teams/50.png",
                "winner": true
              }
            },
            "goals": {
              "home": 0,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 0,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 710618,
              "referee": "M. Atkinson",
              "timezone": "UTC",
              "date": "2021-10-02T14:00:00+00:00",
              "timestamp": 1633183200,
              "periods": {
                "first": 1633183200,
                "second": 1633186800
              },
              "venue": {
                "id": 519,
                "name": "Stamford Bridge",
                "city": "London"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2021,
              "round": "Regular Season - 7",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": true
              },
              "away": {
                "id": 41,
                "name": "Southampton",
                "logo": "https://media.api-sports.io/football/teams/41.png",
                "winner": false
              }
            },
            "goals": {
              "home": 3,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 0
              },
              "fulltime": {
                "home": 3,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 710628,
              "referee": "A. Taylor",
              "timezone": "UTC",
              "date": "2021-10-16T16:30:00+00:00",
              "timestamp": 1634401800,
              "periods": {
                "first": 1634401800,
                "second": 1634405400
              },
              "venue": {
                "id": 10503,
                "name": "Brentford Community Stadium",
                "city": "Brentford, Middlesex"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2021,
              "round": "Regular Season - 8",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 55,
                "name": "Brentford",
                "logo": "https://media.api-sports.io/football/teams/55.png",
                "winner": false
              },
              "away": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": true
              }
            },
            "goals": {
              "home": 0,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 1
              },
              "fulltime": {
                "home": 0,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 710639,
              "referee": "A. Madley",
              "timezone": "UTC",
              "date": "2021-10-23T11:30:00+00:00",
              "timestamp": 1634988600,
              "periods": {
                "first": 1634988600,
                "second": 1634992200
              },
              "venue": {
                "id": 519,
                "name": "Stamford Bridge",
                "city": "London"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2021,
              "round": "Regular Season - 9",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": true
              },
              "away": {
                "id": 71,
                "name": "Norwich",
                "logo": "https://media.api-sports.io/football/teams/71.png",
                "winner": false
              }
            },
            "goals": {
              "home": 7,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 3,
                "away": 0
              },
              "fulltime": {
                "home": 7,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 710651,
              "referee": "P. Tierney",
              "timezone": "UTC",
              "date": "2021-10-30T14:00:00+00:00",
              "timestamp": 1635602400,
              "periods": {
                "first": 1635602400,
                "second": 1635606000
              },
              "venue": {
                "id": 562,
                "name": "St. James' Park",
                "city": "Newcastle upon Tyne"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2021,
              "round": "Regular Season - 10",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 34,
                "name": "Newcastle",
                "logo": "https://media.api-sports.io/football/teams/34.png",
                "winner": false
              },
              "away": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": true
              }
            },
            "goals": {
              "home": 0,
              "away": 3
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 0,
                "away": 3
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 710659,
              "referee": "A. Marriner",
              "timezone": "UTC",
              "date": "2021-11-06T15:00:00+00:00",
              "timestamp": 1636210800,
              "periods": {
                "first": 1636210800,
                "second": 1636214400
              },
              "venue": {
                "id": 519,
                "name": "Stamford Bridge",
                "city": "London"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2021,
              "round": "Regular Season - 11",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": undefined
              },
              "away": {
                "id": 44,
                "name": "Burnley",
                "logo": "https://media.api-sports.io/football/teams/44.png",
                "winner": undefined
              }
            },
            "goals": {
              "home": 1,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 0
              },
              "fulltime": {
                "home": 1,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 710668,
              "referee": "P. Tierney",
              "timezone": "UTC",
              "date": "2021-11-20T12:30:00+00:00",
              "timestamp": 1637411400,
              "periods": {
                "first": 1637411400,
                "second": 1637415000
              },
              "venue": {
                "id": 547,
                "name": "King Power Stadium",
                "city": "Leicester, Leicestershire"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2021,
              "round": "Regular Season - 12",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 46,
                "name": "Leicester",
                "logo": "https://media.api-sports.io/football/teams/46.png",
                "winner": false
              },
              "away": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": true
              }
            },
            "goals": {
              "home": 0,
              "away": 3
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 2
              },
              "fulltime": {
                "home": 0,
                "away": 3
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 710680,
              "referee": "A. Taylor",
              "timezone": "UTC",
              "date": "2021-11-28T16:30:00+00:00",
              "timestamp": 1638117000,
              "periods": {
                "first": 1638117000,
                "second": 1638120600
              },
              "venue": {
                "id": 519,
                "name": "Stamford Bridge",
                "city": "London"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2021,
              "round": "Regular Season - 13",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": undefined
              },
              "away": {
                "id": 33,
                "name": "Manchester United",
                "logo": "https://media.api-sports.io/football/teams/33.png",
                "winner": undefined
              }
            },
            "goals": {
              "home": 1,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 1,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 710689,
              "referee": "D. Coote",
              "timezone": "UTC",
              "date": "2021-12-01T19:30:00+00:00",
              "timestamp": 1638387000,
              "periods": {
                "first": 1638387000,
                "second": 1638390600
              },
              "venue": {
                "id": 596,
                "name": "Vicarage Road",
                "city": "Watford"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2021,
              "round": "Regular Season - 14",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 38,
                "name": "Watford",
                "logo": "https://media.api-sports.io/football/teams/38.png",
                "winner": false
              },
              "away": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": true
              }
            },
            "goals": {
              "home": 1,
              "away": 2
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 1
              },
              "fulltime": {
                "home": 1,
                "away": 2
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 710704,
              "referee": "A. Marriner",
              "timezone": "UTC",
              "date": "2021-12-04T12:30:00+00:00",
              "timestamp": 1638621000,
              "periods": {
                "first": 1638621000,
                "second": 1638624600
              },
              "venue": {
                "id": 598,
                "name": "London Stadium",
                "city": "London"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2021,
              "round": "Regular Season - 15",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 48,
                "name": "West Ham",
                "logo": "https://media.api-sports.io/football/teams/48.png",
                "winner": true
              },
              "away": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": false
              }
            },
            "goals": {
              "home": 3,
              "away": 2
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 2
              },
              "fulltime": {
                "home": 3,
                "away": 2
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 710710,
              "referee": "C. Kavanagh",
              "timezone": "UTC",
              "date": "2021-12-11T15:00:00+00:00",
              "timestamp": 1639234800,
              "periods": {
                "first": 1639234800,
                "second": 1639238400
              },
              "venue": {
                "id": 519,
                "name": "Stamford Bridge",
                "city": "London"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2021,
              "round": "Regular Season - 16",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": true
              },
              "away": {
                "id": 63,
                "name": "Leeds",
                "logo": "https://media.api-sports.io/football/teams/63.png",
                "winner": false
              }
            },
            "goals": {
              "home": 3,
              "away": 2
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 1
              },
              "fulltime": {
                "home": 3,
                "away": 2
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 710723,
              "referee": "M. Oliver",
              "timezone": "UTC",
              "date": "2021-12-16T19:45:00+00:00",
              "timestamp": 1639683900,
              "periods": {
                "first": 1639683900,
                "second": 1639687500
              },
              "venue": {
                "id": 519,
                "name": "Stamford Bridge",
                "city": "London"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2021,
              "round": "Regular Season - 17",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": undefined
              },
              "away": {
                "id": 45,
                "name": "Everton",
                "logo": "https://media.api-sports.io/football/teams/45.png",
                "winner": undefined
              }
            },
            "goals": {
              "home": 1,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 1,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 710735,
              "referee": "D. Coote",
              "timezone": "UTC",
              "date": "2021-12-19T14:00:00+00:00",
              "timestamp": 1639922400,
              "periods": {
                "first": 1639922400,
                "second": 1639926000
              },
              "venue": {
                "id": 600,
                "name": "Molineux Stadium",
                "city": "Wolverhampton, West Midlands"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2021,
              "round": "Regular Season - 18",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 39,
                "name": "Wolves",
                "logo": "https://media.api-sports.io/football/teams/39.png",
                "winner": undefined
              },
              "away": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": undefined
              }
            },
            "goals": {
              "home": 0,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 0,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 710736,
              "referee": "M. Atkinson",
              "timezone": "UTC",
              "date": "2021-12-26T17:30:00+00:00",
              "timestamp": 1640539800,
              "periods": {
                "first": 1640539800,
                "second": 1640543400
              },
              "venue": {
                "id": 495,
                "name": "Villa Park",
                "city": "Birmingham"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2021,
              "round": "Regular Season - 19",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 66,
                "name": "Aston Villa",
                "logo": "https://media.api-sports.io/football/teams/66.png",
                "winner": false
              },
              "away": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": true
              }
            },
            "goals": {
              "home": 1,
              "away": 3
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 1
              },
              "fulltime": {
                "home": 1,
                "away": 3
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 710748,
              "referee": "M. Dean",
              "timezone": "UTC",
              "date": "2021-12-29T19:30:00+00:00",
              "timestamp": 1640806200,
              "periods": {
                "first": 1640806200,
                "second": 1640809800
              },
              "venue": {
                "id": 519,
                "name": "Stamford Bridge",
                "city": "London"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2021,
              "round": "Regular Season - 20",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": undefined
              },
              "away": {
                "id": 51,
                "name": "Brighton",
                "logo": "https://media.api-sports.io/football/teams/51.png",
                "winner": undefined
              }
            },
            "goals": {
              "home": 1,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 0
              },
              "fulltime": {
                "home": 1,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 710758,
              "referee": "A. Taylor",
              "timezone": "UTC",
              "date": "2022-01-02T16:30:00+00:00",
              "timestamp": 1641141000,
              "periods": {
                "first": 1641141000,
                "second": 1641144600
              },
              "venue": {
                "id": 519,
                "name": "Stamford Bridge",
                "city": "London"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2021,
              "round": "Regular Season - 21",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": undefined
              },
              "away": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": undefined
              }
            },
            "goals": {
              "home": 2,
              "away": 2
            },
            "score": {
              "halftime": {
                "home": 2,
                "away": 2
              },
              "fulltime": {
                "home": 2,
                "away": 2
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 710770,
              "referee": "C. Pawson",
              "timezone": "UTC",
              "date": "2022-01-15T12:30:00+00:00",
              "timestamp": 1642249800,
              "periods": {
                "first": 1642249800,
                "second": 1642253400
              },
              "venue": {
                "id": 555,
                "name": "Etihad Stadium",
                "city": "Manchester"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2021,
              "round": "Regular Season - 22",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 50,
                "name": "Manchester City",
                "logo": "https://media.api-sports.io/football/teams/50.png",
                "winner": true
              },
              "away": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": false
              }
            },
            "goals": {
              "home": 1,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 1,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 710778,
              "referee": "P. Tierney",
              "timezone": "UTC",
              "date": "2022-01-23T16:30:00+00:00",
              "timestamp": 1642955400,
              "periods": {
                "first": 1642955400,
                "second": 1642959000
              },
              "venue": {
                "id": 519,
                "name": "Stamford Bridge",
                "city": "London"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2021,
              "round": "Regular Season - 23",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": true
              },
              "away": {
                "id": 47,
                "name": "Tottenham",
                "logo": "https://media.api-sports.io/football/teams/47.png",
                "winner": false
              }
            },
            "goals": {
              "home": 2,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 2,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 710787,
              "referee": "K. Friend",
              "timezone": "UTC",
              "date": "2022-01-18T20:00:00+00:00",
              "timestamp": 1642536000,
              "periods": {
                "first": 1642536000,
                "second": 1642539600
              },
              "venue": {
                "id": 508,
                "name": "The American Express Community Stadium",
                "city": "Falmer, East Sussex"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2021,
              "round": "Regular Season - 24",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 51,
                "name": "Brighton",
                "logo": "https://media.api-sports.io/football/teams/51.png",
                "winner": undefined
              },
              "away": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": undefined
              }
            },
            "goals": {
              "home": 1,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 1
              },
              "fulltime": {
                "home": 1,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 710798,
              "referee": "J. Moss",
              "timezone": "UTC",
              "date": "2022-04-20T18:45:00+00:00",
              "timestamp": 1650480300,
              "periods": {
                "first": 1650480300,
                "second": 1650483900
              },
              "venue": {
                "id": 519,
                "name": "Stamford Bridge",
                "city": "London"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2021,
              "round": "Regular Season - 25",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": false
              },
              "away": {
                "id": 42,
                "name": "Arsenal",
                "logo": "https://media.api-sports.io/football/teams/42.png",
                "winner": true
              }
            },
            "goals": {
              "home": 2,
              "away": 4
            },
            "score": {
              "halftime": {
                "home": 2,
                "away": 2
              },
              "fulltime": {
                "home": 2,
                "away": 4
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 710809,
              "referee": "D. Coote",
              "timezone": "UTC",
              "date": "2022-02-19T15:00:00+00:00",
              "timestamp": 1645282800,
              "periods": {
                "first": 1645282800,
                "second": 1645286400
              },
              "venue": {
                "id": 525,
                "name": "Selhurst Park",
                "city": "London"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2021,
              "round": "Regular Season - 26",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 52,
                "name": "Crystal Palace",
                "logo": "https://media.api-sports.io/football/teams/52.png",
                "winner": false
              },
              "away": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": true
              }
            },
            "goals": {
              "home": 0,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 0,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 710819,
              "referee": "S. Attwell",
              "timezone": "UTC",
              "date": "2022-05-19T19:00:00+00:00",
              "timestamp": 1652986800,
              "periods": {
                "first": 1652986800,
                "second": 1652990400
              },
              "venue": {
                "id": 519,
                "name": "Stamford Bridge",
                "city": "London"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2021,
              "round": "Regular Season - 27",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": undefined
              },
              "away": {
                "id": 46,
                "name": "Leicester",
                "logo": "https://media.api-sports.io/football/teams/46.png",
                "winner": undefined
              }
            },
            "goals": {
              "home": 1,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 1
              },
              "fulltime": {
                "home": 1,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 710827,
              "referee": "A. Marriner",
              "timezone": "UTC",
              "date": "2022-03-05T15:00:00+00:00",
              "timestamp": 1646492400,
              "periods": {
                "first": 1646492400,
                "second": 1646496000
              },
              "venue": {
                "id": 512,
                "name": "Turf Moor",
                "city": "Burnley"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2021,
              "round": "Regular Season - 28",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 44,
                "name": "Burnley",
                "logo": "https://media.api-sports.io/football/teams/44.png",
                "winner": false
              },
              "away": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": true
              }
            },
            "goals": {
              "home": 0,
              "away": 4
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 0,
                "away": 4
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 710839,
              "referee": "D. Coote",
              "timezone": "UTC",
              "date": "2022-03-13T14:00:00+00:00",
              "timestamp": 1647180000,
              "periods": {
                "first": 1647180000,
                "second": 1647183600
              },
              "venue": {
                "id": 519,
                "name": "Stamford Bridge",
                "city": "London"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2021,
              "round": "Regular Season - 29",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": true
              },
              "away": {
                "id": 34,
                "name": "Newcastle",
                "logo": "https://media.api-sports.io/football/teams/34.png",
                "winner": false
              }
            },
            "goals": {
              "home": 1,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 1,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 710852,
              "referee": "M. Atkinson",
              "timezone": "UTC",
              "date": "2022-03-10T19:30:00+00:00",
              "timestamp": 1646940600,
              "periods": {
                "first": 1646940600,
                "second": 1646944200
              },
              "venue": {
                "id": 565,
                "name": "Carrow Road",
                "city": "Norwich, Norfolk"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2021,
              "round": "Regular Season - 30",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 71,
                "name": "Norwich",
                "logo": "https://media.api-sports.io/football/teams/71.png",
                "winner": false
              },
              "away": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": true
              }
            },
            "goals": {
              "home": 1,
              "away": 3
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 2
              },
              "fulltime": {
                "home": 1,
                "away": 3
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 710858,
              "referee": "A. Madley",
              "timezone": "UTC",
              "date": "2022-04-02T14:00:00+00:00",
              "timestamp": 1648908000,
              "periods": {
                "first": 1648908000,
                "second": 1648911600
              },
              "venue": {
                "id": 519,
                "name": "Stamford Bridge",
                "city": "London"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2021,
              "round": "Regular Season - 31",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": false
              },
              "away": {
                "id": 55,
                "name": "Brentford",
                "logo": "https://media.api-sports.io/football/teams/55.png",
                "winner": true
              }
            },
            "goals": {
              "home": 1,
              "away": 4
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 1,
                "away": 4
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 710874,
              "referee": "K. Friend",
              "timezone": "UTC",
              "date": "2022-04-09T14:00:00+00:00",
              "timestamp": 1649512800,
              "periods": {
                "first": 1649512800,
                "second": 1649516400
              },
              "venue": {
                "id": 585,
                "name": "St. Mary's Stadium",
                "city": "Southampton, Hampshire"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2021,
              "round": "Regular Season - 32",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 41,
                "name": "Southampton",
                "logo": "https://media.api-sports.io/football/teams/41.png",
                "winner": false
              },
              "away": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": true
              }
            },
            "goals": {
              "home": 0,
              "away": 6
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 4
              },
              "fulltime": {
                "home": 0,
                "away": 6
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 710878,
              "referee": "A. Taylor",
              "timezone": "UTC",
              "date": "2022-05-11T18:30:00+00:00",
              "timestamp": 1652293800,
              "periods": {
                "first": 1652293800,
                "second": 1652297400
              },
              "venue": {
                "id": 546,
                "name": "Elland Road",
                "city": "Leeds, West Yorkshire"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2021,
              "round": "Regular Season - 33",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 63,
                "name": "Leeds",
                "logo": "https://media.api-sports.io/football/teams/63.png",
                "winner": false
              },
              "away": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": true
              }
            },
            "goals": {
              "home": 0,
              "away": 3
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 1
              },
              "fulltime": {
                "home": 0,
                "away": 3
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 710890,
              "referee": "M. Oliver",
              "timezone": "UTC",
              "date": "2022-04-24T13:00:00+00:00",
              "timestamp": 1650805200,
              "periods": {
                "first": 1650805200,
                "second": 1650808800
              },
              "venue": {
                "id": 519,
                "name": "Stamford Bridge",
                "city": "London"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2021,
              "round": "Regular Season - 34",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": true
              },
              "away": {
                "id": 48,
                "name": "West Ham",
                "logo": "https://media.api-sports.io/football/teams/48.png",
                "winner": false
              }
            },
            "goals": {
              "home": 1,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 1,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 710897,
              "referee": "K. Friend",
              "timezone": "UTC",
              "date": "2022-05-01T13:00:00+00:00",
              "timestamp": 1651410000,
              "periods": {
                "first": 1651410000,
                "second": 1651413600
              },
              "venue": {
                "id": 8560,
                "name": "Goodison Park",
                "city": "Liverpool"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2021,
              "round": "Regular Season - 35",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 45,
                "name": "Everton",
                "logo": "https://media.api-sports.io/football/teams/45.png",
                "winner": true
              },
              "away": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": false
              }
            },
            "goals": {
              "home": 1,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 1,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 710910,
              "referee": "P. Bankes",
              "timezone": "UTC",
              "date": "2022-05-07T14:00:00+00:00",
              "timestamp": 1651932000,
              "periods": {
                "first": 1651932000,
                "second": 1651935600
              },
              "venue": {
                "id": 519,
                "name": "Stamford Bridge",
                "city": "London"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2021,
              "round": "Regular Season - 36",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": undefined
              },
              "away": {
                "id": 39,
                "name": "Wolves",
                "logo": "https://media.api-sports.io/football/teams/39.png",
                "winner": undefined
              }
            },
            "goals": {
              "home": 2,
              "away": 2
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 2,
                "away": 2
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 710919,
              "referee": "M. Dean",
              "timezone": "UTC",
              "date": "2022-04-28T18:45:00+00:00",
              "timestamp": 1651171500,
              "periods": {
                "first": 1651171500,
                "second": 1651175100
              },
              "venue": {
                "id": 556,
                "name": "Old Trafford",
                "city": "Manchester"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2021,
              "round": "Regular Season - 37",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 33,
                "name": "Manchester United",
                "logo": "https://media.api-sports.io/football/teams/33.png",
                "winner": undefined
              },
              "away": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": undefined
              }
            },
            "goals": {
              "home": 1,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 1,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 710930,
              "referee": "M. Dean",
              "timezone": "UTC",
              "date": "2022-05-22T15:00:00+00:00",
              "timestamp": 1653231600,
              "periods": {
                "first": 1653231600,
                "second": 1653235200
              },
              "venue": {
                "id": 519,
                "name": "Stamford Bridge",
                "city": "London"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2021,
              "round": "Regular Season - 38",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": true
              },
              "away": {
                "id": 38,
                "name": "Watford",
                "logo": "https://media.api-sports.io/football/teams/38.png",
                "winner": false
              }
            },
            "goals": {
              "home": 2,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 0
              },
              "fulltime": {
                "home": 2,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 736041,
              "referee": "A. Marriner",
              "timezone": "UTC",
              "date": "2021-08-01T14:00:00+00:00",
              "timestamp": 1627826400,
              "periods": {
                "first": 1627826400,
                "second": 1627830000
              },
              "venue": {
                "id": 494,
                "name": "Emirates Stadium",
                "city": "London"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 667,
              "name": "Friendlies Clubs",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/667.png",
              "flag": undefined,
              "season": 2021,
              "round": "Club Friendlies 1",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 42,
                "name": "Arsenal",
                "logo": "https://media.api-sports.io/football/teams/42.png",
                "winner": false
              },
              "away": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": true
              }
            },
            "goals": {
              "home": 1,
              "away": 2
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 1
              },
              "fulltime": {
                "home": 1,
                "away": 2
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 736042,
              "referee": "K. Stroud",
              "timezone": "UTC",
              "date": "2021-08-04T18:45:00+00:00",
              "timestamp": 1628102700,
              "periods": {
                "first": 1628102700,
                "second": 1628106300
              },
              "venue": {
                "id": 519,
                "name": "Stamford Bridge",
                "city": "London"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 667,
              "name": "Friendlies Clubs",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/667.png",
              "flag": undefined,
              "season": 2021,
              "round": "Club Friendlies 1",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": undefined
              },
              "away": {
                "id": 47,
                "name": "Tottenham",
                "logo": "https://media.api-sports.io/football/teams/47.png",
                "winner": undefined
              }
            },
            "goals": {
              "home": 2,
              "away": 2
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 0
              },
              "fulltime": {
                "home": 2,
                "away": 2
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 739335,
              "referee": undefined,
              "timezone": "UTC",
              "date": "2021-07-17T08:00:00+00:00",
              "timestamp": 1626508800,
              "periods": {
                "first": 1626508800,
                "second": 1626512400
              },
              "venue": {
                "id": undefined,
                "name": undefined,
                "city": undefined
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 667,
              "name": "Friendlies Clubs",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/667.png",
              "flag": undefined,
              "season": 2021,
              "round": "Club Friendlies 5",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": true
              },
              "away": {
                "id": 1350,
                "name": "Peterborough",
                "logo": "https://media.api-sports.io/football/teams/1350.png",
                "winner": false
              }
            },
            "goals": {
              "home": 6,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 2,
                "away": 1
              },
              "fulltime": {
                "home": 6,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 740320,
              "referee": undefined,
              "timezone": "UTC",
              "date": "2021-07-27T18:45:00+00:00",
              "timestamp": 1627411500,
              "periods": {
                "first": undefined,
                "second": undefined
              },
              "venue": {
                "id": undefined,
                "name": undefined,
                "city": undefined
              },
              "status": {
                "long": "Match Cancelled",
                "short": "Canc",
                "elapsed": undefined,
                "extra": undefined
              }
            },
            "league": {
              "id": 667,
              "name": "Friendlies Clubs",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/667.png",
              "flag": undefined,
              "season": 2021,
              "round": "Club Friendlies 5",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": undefined
              },
              "away": {
                "id": 35,
                "name": "Bournemouth",
                "logo": "https://media.api-sports.io/football/teams/35.png",
                "winner": undefined
              }
            },
            "goals": {
              "home": undefined,
              "away": undefined
            },
            "score": {
              "halftime": {
                "home": undefined,
                "away": undefined
              },
              "fulltime": {
                "home": undefined,
                "away": undefined
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 740414,
              "referee": undefined,
              "timezone": "UTC",
              "date": "2021-07-22T17:30:00+00:00",
              "timestamp": 1626975000,
              "periods": {
                "first": undefined,
                "second": undefined
              },
              "venue": {
                "id": undefined,
                "name": undefined,
                "city": undefined
              },
              "status": {
                "long": "Match Cancelled",
                "short": "CANC",
                "elapsed": undefined,
                "extra": undefined
              }
            },
            "league": {
              "id": 667,
              "name": "Friendlies Clubs",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/667.png",
              "flag": undefined,
              "season": 2021,
              "round": "Club Friendlies 5",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": undefined
              },
              "away": {
                "id": 3850,
                "name": "Drogheda United",
                "logo": "https://media.api-sports.io/football/teams/3850.png",
                "winner": undefined
              }
            },
            "goals": {
              "home": undefined,
              "away": undefined
            },
            "score": {
              "halftime": {
                "home": undefined,
                "away": undefined
              },
              "fulltime": {
                "home": undefined,
                "away": undefined
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 747513,
              "referee": undefined,
              "timezone": "UTC",
              "date": "2021-07-27T00:00:00+00:00",
              "timestamp": 1627344000,
              "periods": {
                "first": 1627344000,
                "second": 1627347600
              },
              "venue": {
                "id": 504,
                "name": "Vitality Stadium",
                "city": "Bournemouth, Dorset"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 667,
              "name": "Friendlies Clubs",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/667.png",
              "flag": undefined,
              "season": 2021,
              "round": "Club Friendlies 1",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 35,
                "name": "Bournemouth",
                "logo": "https://media.api-sports.io/football/teams/35.png",
                "winner": false
              },
              "away": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": true
              }
            },
            "goals": {
              "home": 1,
              "away": 2
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 1,
                "away": 2
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 778346,
              "referee": undefined,
              "timezone": "UTC",
              "date": "2021-08-15T11:30:00+00:00",
              "timestamp": 1629027000,
              "periods": {
                "first": 1629027000,
                "second": 1629030600
              },
              "venue": {
                "id": undefined,
                "name": undefined,
                "city": undefined
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 667,
              "name": "Friendlies Clubs",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/667.png",
              "flag": undefined,
              "season": 2021,
              "round": "Club Friendlies 5",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 8665,
                "name": "Weymouth",
                "logo": "https://media.api-sports.io/football/teams/8665.png",
                "winner": false
              },
              "away": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": true
              }
            },
            "goals": {
              "home": 0,
              "away": 13
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 8
              },
              "fulltime": {
                "home": 0,
                "away": 13
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 787054,
              "referee": "G. Scott",
              "timezone": "UTC",
              "date": "2021-09-22T18:45:00+00:00",
              "timestamp": 1632336300,
              "periods": {
                "first": 1632336300,
                "second": 1632339900
              },
              "venue": {
                "id": 519,
                "name": "Stamford Bridge",
                "city": "London"
              },
              "status": {
                "long": "Match Finished",
                "short": "PEN",
                "elapsed": 120,
                "extra": undefined
              }
            },
            "league": {
              "id": 48,
              "name": "League Cup",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/48.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2021,
              "round": "3rd Round",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": true
              },
              "away": {
                "id": 66,
                "name": "Aston Villa",
                "logo": "https://media.api-sports.io/football/teams/66.png",
                "winner": false
              }
            },
            "goals": {
              "home": 1,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 1,
                "away": 1
              },
              "extratime": {
                "home": 0,
                "away": 0
              },
              "penalty": {
                "home": 4,
                "away": 3
              }
            }
          },
          {
            "fixture": {
              "id": 787566,
              "referee": "B. Frankowski",
              "timezone": "UTC",
              "date": "2021-09-14T19:00:00+00:00",
              "timestamp": 1631646000,
              "periods": {
                "first": 1631646000,
                "second": 1631649600
              },
              "venue": {
                "id": 519,
                "name": "Stamford Bridge",
                "city": "London"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 2,
              "name": "UEFA Champions League",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/2.png",
              "flag": undefined,
              "season": 2021,
              "round": "Group Stage - 1",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": true
              },
              "away": {
                "id": 596,
                "name": "Zenit Saint Petersburg",
                "logo": "https://media.api-sports.io/football/teams/596.png",
                "winner": false
              }
            },
            "goals": {
              "home": 1,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 1,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 787591,
              "referee": "Jesús Gil",
              "timezone": "UTC",
              "date": "2021-09-29T19:00:00+00:00",
              "timestamp": 1632942000,
              "periods": {
                "first": 1632942000,
                "second": 1632945600
              },
              "venue": {
                "id": 909,
                "name": "Allianz Stadium",
                "city": "Torino"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 2,
              "name": "UEFA Champions League",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/2.png",
              "flag": undefined,
              "season": 2021,
              "round": "Group Stage - 2",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 496,
                "name": "Juventus",
                "logo": "https://media.api-sports.io/football/teams/496.png",
                "winner": true
              },
              "away": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": false
              }
            },
            "goals": {
              "home": 1,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 1,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 787606,
              "referee": "F. Letexier",
              "timezone": "UTC",
              "date": "2021-10-20T19:00:00+00:00",
              "timestamp": 1634756400,
              "periods": {
                "first": 1634756400,
                "second": 1634760000
              },
              "venue": {
                "id": 519,
                "name": "Stamford Bridge",
                "city": "London"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 2,
              "name": "UEFA Champions League",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/2.png",
              "flag": undefined,
              "season": 2021,
              "round": "Group Stage - 3",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": true
              },
              "away": {
                "id": 375,
                "name": "Malmo FF",
                "logo": "https://media.api-sports.io/football/teams/375.png",
                "winner": false
              }
            },
            "goals": {
              "home": 4,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 2,
                "away": 0
              },
              "fulltime": {
                "home": 4,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 787609,
              "referee": "F. Brych",
              "timezone": "UTC",
              "date": "2021-11-02T17:45:00+00:00",
              "timestamp": 1635875100,
              "periods": {
                "first": 1635875100,
                "second": 1635878700
              },
              "venue": {
                "id": 1518,
                "name": "Eleda Stadion",
                "city": "Malmö"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 2,
              "name": "UEFA Champions League",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/2.png",
              "flag": undefined,
              "season": 2021,
              "round": "Group Stage - 4",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 375,
                "name": "Malmo FF",
                "logo": "https://media.api-sports.io/football/teams/375.png",
                "winner": false
              },
              "away": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": true
              }
            },
            "goals": {
              "home": 0,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 0,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 787630,
              "referee": "S. Jovanović",
              "timezone": "UTC",
              "date": "2021-11-23T20:00:00+00:00",
              "timestamp": 1637697600,
              "periods": {
                "first": 1637697600,
                "second": 1637701200
              },
              "venue": {
                "id": 519,
                "name": "Stamford Bridge",
                "city": "London"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 2,
              "name": "UEFA Champions League",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/2.png",
              "flag": undefined,
              "season": 2021,
              "round": "Group Stage - 5",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": true
              },
              "away": {
                "id": 496,
                "name": "Juventus",
                "logo": "https://media.api-sports.io/football/teams/496.png",
                "winner": false
              }
            },
            "goals": {
              "home": 4,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 0
              },
              "fulltime": {
                "home": 4,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 787649,
              "referee": "S. Gözübüyük",
              "timezone": "UTC",
              "date": "2021-12-08T17:45:00+00:00",
              "timestamp": 1638985500,
              "periods": {
                "first": 1638985500,
                "second": 1638989100
              },
              "venue": {
                "id": undefined,
                "name": "Saint-Petersburg Stadium",
                "city": "St. Petersburg"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 2,
              "name": "UEFA Champions League",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/2.png",
              "flag": undefined,
              "season": 2021,
              "round": "Group Stage - 6",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 596,
                "name": "Zenit Saint Petersburg",
                "logo": "https://media.api-sports.io/football/teams/596.png",
                "winner": undefined
              },
              "away": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": undefined
              }
            },
            "goals": {
              "home": 3,
              "away": 3
            },
            "score": {
              "halftime": {
                "home": 2,
                "away": 1
              },
              "fulltime": {
                "home": 3,
                "away": 3
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 800352,
              "referee": "K. Friend",
              "timezone": "UTC",
              "date": "2021-10-26T18:45:00+00:00",
              "timestamp": 1635273900,
              "periods": {
                "first": 1635273900,
                "second": 1635277500
              },
              "venue": {
                "id": 519,
                "name": "Stamford Bridge",
                "city": "London"
              },
              "status": {
                "long": "Match Finished",
                "short": "PEN",
                "elapsed": 120,
                "extra": undefined
              }
            },
            "league": {
              "id": 48,
              "name": "League Cup",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/48.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2021,
              "round": "Round of 16",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": true
              },
              "away": {
                "id": 41,
                "name": "Southampton",
                "logo": "https://media.api-sports.io/football/teams/41.png",
                "winner": false
              }
            },
            "goals": {
              "home": 1,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 0
              },
              "fulltime": {
                "home": 1,
                "away": 1
              },
              "extratime": {
                "home": 0,
                "away": 0
              },
              "penalty": {
                "home": 4,
                "away": 3
              }
            }
          },
          {
            "fixture": {
              "id": 810062,
              "referee": "A. Marriner",
              "timezone": "UTC",
              "date": "2021-12-22T19:45:00+00:00",
              "timestamp": 1640202300,
              "periods": {
                "first": 1640202300,
                "second": 1640205900
              },
              "venue": {
                "id": 10503,
                "name": "Brentford Community Stadium",
                "city": "Brentford, Middlesex"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 48,
              "name": "League Cup",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/48.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2021,
              "round": "Quarter-finals",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 55,
                "name": "Brentford",
                "logo": "https://media.api-sports.io/football/teams/55.png",
                "winner": false
              },
              "away": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": true
              }
            },
            "goals": {
              "home": 0,
              "away": 2
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 0,
                "away": 2
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 815143,
              "referee": "J. Gillett",
              "timezone": "UTC",
              "date": "2022-01-08T17:30:00+00:00",
              "timestamp": 1641663000,
              "periods": {
                "first": 1641663000,
                "second": 1641666600
              },
              "venue": {
                "id": 519,
                "name": "Stamford Bridge",
                "city": "London"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 45,
              "name": "FA Cup",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/45.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2021,
              "round": "3rd Round",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": true
              },
              "away": {
                "id": 1345,
                "name": "Chesterfield",
                "logo": "https://media.api-sports.io/football/teams/1345.png",
                "winner": false
              }
            },
            "goals": {
              "home": 5,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 4,
                "away": 0
              },
              "fulltime": {
                "home": 5,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 816248,
              "referee": "Jesús Gil",
              "timezone": "UTC",
              "date": "2022-02-22T20:00:00+00:00",
              "timestamp": 1645560000,
              "periods": {
                "first": 1645560000,
                "second": 1645563600
              },
              "venue": {
                "id": 519,
                "name": "Stamford Bridge",
                "city": "London"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 2,
              "name": "UEFA Champions League",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/2.png",
              "flag": undefined,
              "season": 2021,
              "round": "Round of 16",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": true
              },
              "away": {
                "id": 79,
                "name": "Lille",
                "logo": "https://media.api-sports.io/football/teams/79.png",
                "winner": false
              }
            },
            "goals": {
              "home": 2,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 0
              },
              "fulltime": {
                "home": 2,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 816249,
              "referee": "D. Massa",
              "timezone": "UTC",
              "date": "2022-03-16T20:00:00+00:00",
              "timestamp": 1647460800,
              "periods": {
                "first": 1647460800,
                "second": 1647464400
              },
              "venue": {
                "id": 655,
                "name": "Stade Pierre-Mauroy",
                "city": "Villeneuve d'Ascq"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 2,
              "name": "UEFA Champions League",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/2.png",
              "flag": undefined,
              "season": 2021,
              "round": "Round of 16",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 79,
                "name": "Lille",
                "logo": "https://media.api-sports.io/football/teams/79.png",
                "winner": false
              },
              "away": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": true
              }
            },
            "goals": {
              "home": 1,
              "away": 2
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 1
              },
              "fulltime": {
                "home": 1,
                "away": 2
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 820052,
              "referee": "C. Pawson",
              "timezone": "UTC",
              "date": "2022-01-05T19:45:00+00:00",
              "timestamp": 1641411900,
              "periods": {
                "first": 1641411900,
                "second": 1641415500
              },
              "venue": {
                "id": 519,
                "name": "Stamford Bridge",
                "city": "London"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 48,
              "name": "League Cup",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/48.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2021,
              "round": "Semi-finals",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": true
              },
              "away": {
                "id": 47,
                "name": "Tottenham",
                "logo": "https://media.api-sports.io/football/teams/47.png",
                "winner": false
              }
            },
            "goals": {
              "home": 2,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 2,
                "away": 0
              },
              "fulltime": {
                "home": 2,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 820053,
              "referee": "A. Marriner",
              "timezone": "UTC",
              "date": "2022-01-12T19:45:00+00:00",
              "timestamp": 1642016700,
              "periods": {
                "first": 1642016700,
                "second": 1642020300
              },
              "venue": {
                "id": 593,
                "name": "Tottenham Hotspur Stadium",
                "city": "London"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 48,
              "name": "League Cup",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/48.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2021,
              "round": "Semi-finals",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 47,
                "name": "Tottenham",
                "logo": "https://media.api-sports.io/football/teams/47.png",
                "winner": false
              },
              "away": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": true
              }
            },
            "goals": {
              "home": 0,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 1
              },
              "fulltime": {
                "home": 0,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 824593,
              "referee": "S. Hooper",
              "timezone": "UTC",
              "date": "2022-02-05T12:30:00+00:00",
              "timestamp": 1644064200,
              "periods": {
                "first": 1644064200,
                "second": 1644067800
              },
              "venue": {
                "id": 519,
                "name": "Stamford Bridge",
                "city": "London"
              },
              "status": {
                "long": "Match Finished",
                "short": "AET",
                "elapsed": 120,
                "extra": undefined
              }
            },
            "league": {
              "id": 45,
              "name": "FA Cup",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/45.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2021,
              "round": "4th Round",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": true
              },
              "away": {
                "id": 1357,
                "name": "Plymouth",
                "logo": "https://media.api-sports.io/football/teams/1357.png",
                "winner": false
              }
            },
            "goals": {
              "home": 2,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 1
              },
              "fulltime": {
                "home": 1,
                "away": 1
              },
              "extratime": {
                "home": 1,
                "away": 0
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 827495,
              "referee": "S. Attwell",
              "timezone": "UTC",
              "date": "2022-02-27T16:30:00+00:00",
              "timestamp": 1645979400,
              "periods": {
                "first": 1645979400,
                "second": 1645983000
              },
              "venue": {
                "id": 489,
                "name": "Wembley Stadium",
                "city": "London"
              },
              "status": {
                "long": "Match Finished",
                "short": "PEN",
                "elapsed": 120,
                "extra": undefined
              }
            },
            "league": {
              "id": 48,
              "name": "League Cup",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/48.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2021,
              "round": "Final",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": false
              },
              "away": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              }
            },
            "goals": {
              "home": 0,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 0,
                "away": 0
              },
              "extratime": {
                "home": 0,
                "away": 0
              },
              "penalty": {
                "home": 10,
                "away": 11
              }
            }
          },
          {
            "fixture": {
              "id": 839024,
              "referee": "C. Ramos",
              "timezone": "UTC",
              "date": "2022-02-09T16:30:00+00:00",
              "timestamp": 1644424200,
              "periods": {
                "first": 1644424200,
                "second": 1644427800
              },
              "venue": {
                "id": undefined,
                "name": "Mohammed Bin Zayed Stadium",
                "city": "Abu Dhabi"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 15,
              "name": "FIFA Club World Cup",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/15.png",
              "flag": undefined,
              "season": 2021,
              "round": "Semi-finals",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 2932,
                "name": "Al-Hilal Saudi FC",
                "logo": "https://media.api-sports.io/football/teams/2932.png",
                "winner": false
              },
              "away": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": true
              }
            },
            "goals": {
              "home": 0,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 1
              },
              "fulltime": {
                "home": 0,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 839033,
              "referee": "P. Bankes",
              "timezone": "UTC",
              "date": "2022-03-02T19:15:00+00:00",
              "timestamp": 1646248500,
              "periods": {
                "first": 1646248500,
                "second": 1646252100
              },
              "venue": {
                "id": 551,
                "name": "Kenilworth Road",
                "city": "Luton, Bedfordshire"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 45,
              "name": "FA Cup",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/45.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2021,
              "round": "5th Round",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 1359,
                "name": "Luton",
                "logo": "https://media.api-sports.io/football/teams/1359.png",
                "winner": false
              },
              "away": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": true
              }
            },
            "goals": {
              "home": 2,
              "away": 3
            },
            "score": {
              "halftime": {
                "home": 2,
                "away": 1
              },
              "fulltime": {
                "home": 2,
                "away": 3
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 839854,
              "referee": "C. Beath",
              "timezone": "UTC",
              "date": "2022-02-12T16:30:00+00:00",
              "timestamp": 1644683400,
              "periods": {
                "first": 1644683400,
                "second": 1644687000
              },
              "venue": {
                "id": undefined,
                "name": "Mohammed Bin Zayed Stadium",
                "city": "Abu Dhabi"
              },
              "status": {
                "long": "Match Finished",
                "short": "AET",
                "elapsed": 120,
                "extra": undefined
              }
            },
            "league": {
              "id": 15,
              "name": "FIFA Club World Cup",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/15.png",
              "flag": undefined,
              "season": 2021,
              "round": "Final",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": true
              },
              "away": {
                "id": 121,
                "name": "Palmeiras",
                "logo": "https://media.api-sports.io/football/teams/121.png",
                "winner": false
              }
            },
            "goals": {
              "home": 2,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 1,
                "away": 1
              },
              "extratime": {
                "home": 1,
                "away": 0
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 846625,
              "referee": "P. Tierney",
              "timezone": "UTC",
              "date": "2022-03-19T17:15:00+00:00",
              "timestamp": 1647710100,
              "periods": {
                "first": 1647710100,
                "second": 1647713700
              },
              "venue": {
                "id": 558,
                "name": "Riverside Stadium",
                "city": "Middlesbrough"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 45,
              "name": "FA Cup",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/45.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2021,
              "round": "Quarter-finals",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 70,
                "name": "Middlesbrough",
                "logo": "https://media.api-sports.io/football/teams/70.png",
                "winner": false
              },
              "away": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": true
              }
            },
            "goals": {
              "home": 0,
              "away": 2
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 2
              },
              "fulltime": {
                "home": 0,
                "away": 2
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 851368,
              "referee": "C. Turpin",
              "timezone": "UTC",
              "date": "2022-04-06T19:00:00+00:00",
              "timestamp": 1649271600,
              "periods": {
                "first": 1649271600,
                "second": 1649275200
              },
              "venue": {
                "id": 519,
                "name": "Stamford Bridge",
                "city": "London"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 2,
              "name": "UEFA Champions League",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/2.png",
              "flag": undefined,
              "season": 2021,
              "round": "Quarter-finals",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": false
              },
              "away": {
                "id": 541,
                "name": "Real Madrid",
                "logo": "https://media.api-sports.io/football/teams/541.png",
                "winner": true
              }
            },
            "goals": {
              "home": 1,
              "away": 3
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 2
              },
              "fulltime": {
                "home": 1,
                "away": 3
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 851369,
              "referee": "S. Marciniak",
              "timezone": "UTC",
              "date": "2022-04-12T19:00:00+00:00",
              "timestamp": 1649790000,
              "periods": {
                "first": 1649790000,
                "second": 1649793600
              },
              "venue": {
                "id": 1456,
                "name": "Estadio Santiago Bernabéu",
                "city": "Madrid"
              },
              "status": {
                "long": "Match Finished",
                "short": "AET",
                "elapsed": 120,
                "extra": undefined
              }
            },
            "league": {
              "id": 2,
              "name": "UEFA Champions League",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/2.png",
              "flag": undefined,
              "season": 2021,
              "round": "Quarter-finals",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 541,
                "name": "Real Madrid",
                "logo": "https://media.api-sports.io/football/teams/541.png",
                "winner": false
              },
              "away": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": true
              }
            },
            "goals": {
              "home": 2,
              "away": 3
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 1
              },
              "fulltime": {
                "home": 1,
                "away": 3
              },
              "extratime": {
                "home": 1,
                "away": 0
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 851978,
              "referee": "A. Taylor",
              "timezone": "UTC",
              "date": "2022-04-17T15:30:00+00:00",
              "timestamp": 1650209400,
              "periods": {
                "first": 1650209400,
                "second": 1650213000
              },
              "venue": {
                "id": 489,
                "name": "Wembley Stadium",
                "city": "London"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 45,
              "name": "FA Cup",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/45.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2021,
              "round": "Semi-finals",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": true
              },
              "away": {
                "id": 52,
                "name": "Crystal Palace",
                "logo": "https://media.api-sports.io/football/teams/52.png",
                "winner": false
              }
            },
            "goals": {
              "home": 2,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 2,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 858021,
              "referee": "C. Pawson",
              "timezone": "UTC",
              "date": "2022-05-14T15:45:00+00:00",
              "timestamp": 1652543100,
              "periods": {
                "first": 1652543100,
                "second": 1652546700
              },
              "venue": {
                "id": 489,
                "name": "Wembley Stadium",
                "city": "London"
              },
              "status": {
                "long": "Match Finished",
                "short": "PEN",
                "elapsed": 120,
                "extra": undefined
              }
            },
            "league": {
              "id": 45,
              "name": "FA Cup",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/45.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2021,
              "round": "Final",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": false
              },
              "away": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              }
            },
            "goals": {
              "home": 0,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 0,
                "away": 0
              },
              "extratime": {
                "home": 0,
                "away": 0
              },
              "penalty": {
                "home": 5,
                "away": 6
              }
            }
          }
        ]
      },
      "headers": {
        "date": "Sun, 23 Nov 2025 10:54:43 GMT",
        "content-type": "application/json",
        "transfer-encoding": "chunked",
        "connection": "keep-alive",
        "server": "cloudflare",
        "vary": "Accept-Encoding",
        "access-control-allow-origin": "*",
        "access-control-allow-credentials": "True",
        "access-control-allow-methods": "GET, OPTIONS",
        "access-control-allow-headers": "x-rapidapi-key, x-apisports-key, x-rapidapi-host",
        "x-ratelimit-limit": "10",
        "x-ratelimit-remaining": "9",
        "x-ratelimit-requests-limit": "100",
        "x-ratelimit-requests-remaining": "90",
        "x-envoy-upstream-service-time": "14",
        "cache-control": "no-store, no-cache, must-revalidate",
        "pragma": "no-cache",
        "expires": "0",
        "strict-transport-security": "max-age=31536000; includeSubDomains",
        "cf-cache-status": "DYNAMIC",
        "nel": "{\"report_to\":\"cf-nel\",\"success_fraction\":0.0,\"max_age\":604800}",
        "report-to": "{\"group\":\"cf-nel\",\"max_age\":604800,\"endpoints\":[{\"url\":\"https://a.nel.cloudflare.com/report/v4?s=BIddRbYe1X8sBUgyU2LhcxM5kpluJ%2BJlxzJWj%2BPONcrqZVqLqh5WeXM3X4VnTwbCXS1UJUFSlHrqe5gI2yN0oQRvMI1sDonUAUZn8gK2eFJ7Ke0TMg0N7A%3D%3D\"}]}",
        "cf-ray": "9a30214fce97805b-ARN"
      }
    }
  },
  {
    "request": {
      "method": "GET",
      "url": "https://v3.football.api-sports.io/standings",
      "headers": {
        "x-rapidapi-key": "52dd...5e7f",
        "x-rapidapi-host": "v3.football.api-sports.io"
      },
      "queryParams": {
        "league": "39",
        "season": "2023"
      }
    },
    "response": {
      "status": 200,
      "data": {
        "get": "standings",
        "parameters": {
          "league": "39",
          "season": "2023"
        },
        "errors": [],
        "results": 1,
        "paging": {
          "current": 1,
          "total": 1
        },
        "response": [
          {
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2023,
              "standings": [
                [
                  {
                    "rank": 1,
                    "team": {
                      "id": 50,
                      "name": "Manchester City",
                      "logo": "https://media.api-sports.io/football/teams/50.png"
                    },
                    "points": 91,
                    "goalsDiff": 62,
                    "group": "Premier League",
                    "form": "WWWWW",
                    "status": "same",
                    "description": "Promotion - Champions League (Group Stage: )",
                    "all": {
                      "played": 38,
                      "win": 28,
                      "draw": 7,
                      "lose": 3,
                      "goals": {
                        "for": 96,
                        "against": 34
                      }
                    },
                    "home": {
                      "played": 19,
                      "win": 14,
                      "draw": 5,
                      "lose": 0,
                      "goals": {
                        "for": 51,
                        "against": 16
                      }
                    },
                    "away": {
                      "played": 19,
                      "win": 14,
                      "draw": 2,
                      "lose": 3,
                      "goals": {
                        "for": 45,
                        "against": 18
                      }
                    },
                    "update": "2024-05-28T00:00:00+00:00"
                  },
                  {
                    "rank": 2,
                    "team": {
                      "id": 42,
                      "name": "Arsenal",
                      "logo": "https://media.api-sports.io/football/teams/42.png"
                    },
                    "points": 89,
                    "goalsDiff": 62,
                    "group": "Premier League",
                    "form": "WWWWW",
                    "status": "same",
                    "description": "Promotion - Champions League (Group Stage: )",
                    "all": {
                      "played": 38,
                      "win": 28,
                      "draw": 5,
                      "lose": 5,
                      "goals": {
                        "for": 91,
                        "against": 29
                      }
                    },
                    "home": {
                      "played": 19,
                      "win": 15,
                      "draw": 2,
                      "lose": 2,
                      "goals": {
                        "for": 48,
                        "against": 16
                      }
                    },
                    "away": {
                      "played": 19,
                      "win": 13,
                      "draw": 3,
                      "lose": 3,
                      "goals": {
                        "for": 43,
                        "against": 13
                      }
                    },
                    "update": "2024-05-28T00:00:00+00:00"
                  },
                  {
                    "rank": 3,
                    "team": {
                      "id": 40,
                      "name": "Liverpool",
                      "logo": "https://media.api-sports.io/football/teams/40.png"
                    },
                    "points": 82,
                    "goalsDiff": 45,
                    "group": "Premier League",
                    "form": "WDWDL",
                    "status": "same",
                    "description": "Promotion - Champions League (Group Stage: )",
                    "all": {
                      "played": 38,
                      "win": 24,
                      "draw": 10,
                      "lose": 4,
                      "goals": {
                        "for": 86,
                        "against": 41
                      }
                    },
                    "home": {
                      "played": 19,
                      "win": 15,
                      "draw": 3,
                      "lose": 1,
                      "goals": {
                        "for": 49,
                        "against": 17
                      }
                    },
                    "away": {
                      "played": 19,
                      "win": 9,
                      "draw": 7,
                      "lose": 3,
                      "goals": {
                        "for": 37,
                        "against": 24
                      }
                    },
                    "update": "2024-05-28T00:00:00+00:00"
                  },
                  {
                    "rank": 4,
                    "team": {
                      "id": 66,
                      "name": "Aston Villa",
                      "logo": "https://media.api-sports.io/football/teams/66.png"
                    },
                    "points": 68,
                    "goalsDiff": 15,
                    "group": "Premier League",
                    "form": "LDLDW",
                    "status": "same",
                    "description": "Promotion - Champions League (Group Stage: )",
                    "all": {
                      "played": 38,
                      "win": 20,
                      "draw": 8,
                      "lose": 10,
                      "goals": {
                        "for": 76,
                        "against": 61
                      }
                    },
                    "home": {
                      "played": 19,
                      "win": 12,
                      "draw": 4,
                      "lose": 3,
                      "goals": {
                        "for": 48,
                        "against": 28
                      }
                    },
                    "away": {
                      "played": 19,
                      "win": 8,
                      "draw": 4,
                      "lose": 7,
                      "goals": {
                        "for": 28,
                        "against": 33
                      }
                    },
                    "update": "2024-05-28T00:00:00+00:00"
                  },
                  {
                    "rank": 5,
                    "team": {
                      "id": 47,
                      "name": "Tottenham",
                      "logo": "https://media.api-sports.io/football/teams/47.png"
                    },
                    "points": 66,
                    "goalsDiff": 13,
                    "group": "Premier League",
                    "form": "WLWLL",
                    "status": "same",
                    "description": "Promotion - Europa League (Group Stage: )",
                    "all": {
                      "played": 38,
                      "win": 20,
                      "draw": 6,
                      "lose": 12,
                      "goals": {
                        "for": 74,
                        "against": 61
                      }
                    },
                    "home": {
                      "played": 19,
                      "win": 13,
                      "draw": 0,
                      "lose": 6,
                      "goals": {
                        "for": 38,
                        "against": 27
                      }
                    },
                    "away": {
                      "played": 19,
                      "win": 7,
                      "draw": 6,
                      "lose": 6,
                      "goals": {
                        "for": 36,
                        "against": 34
                      }
                    },
                    "update": "2024-05-28T00:00:00+00:00"
                  },
                  {
                    "rank": 6,
                    "team": {
                      "id": 49,
                      "name": "Chelsea",
                      "logo": "https://media.api-sports.io/football/teams/49.png"
                    },
                    "points": 63,
                    "goalsDiff": 14,
                    "group": "Premier League",
                    "form": "WWWWW",
                    "status": "same",
                    "description": "Promotion - Europa Conference League (Qualification: )",
                    "all": {
                      "played": 38,
                      "win": 18,
                      "draw": 9,
                      "lose": 11,
                      "goals": {
                        "for": 77,
                        "against": 63
                      }
                    },
                    "home": {
                      "played": 19,
                      "win": 11,
                      "draw": 4,
                      "lose": 4,
                      "goals": {
                        "for": 44,
                        "against": 26
                      }
                    },
                    "away": {
                      "played": 19,
                      "win": 7,
                      "draw": 5,
                      "lose": 7,
                      "goals": {
                        "for": 33,
                        "against": 37
                      }
                    },
                    "update": "2024-05-28T00:00:00+00:00"
                  },
                  {
                    "rank": 7,
                    "team": {
                      "id": 34,
                      "name": "Newcastle",
                      "logo": "https://media.api-sports.io/football/teams/34.png"
                    },
                    "points": 60,
                    "goalsDiff": 23,
                    "group": "Premier League",
                    "form": "WLDWW",
                    "status": "same",
                    "description": undefined,
                    "all": {
                      "played": 38,
                      "win": 18,
                      "draw": 6,
                      "lose": 14,
                      "goals": {
                        "for": 85,
                        "against": 62
                      }
                    },
                    "home": {
                      "played": 19,
                      "win": 12,
                      "draw": 4,
                      "lose": 3,
                      "goals": {
                        "for": 49,
                        "against": 22
                      }
                    },
                    "away": {
                      "played": 19,
                      "win": 6,
                      "draw": 2,
                      "lose": 11,
                      "goals": {
                        "for": 36,
                        "against": 40
                      }
                    },
                    "update": "2024-05-28T00:00:00+00:00"
                  },
                  {
                    "rank": 8,
                    "team": {
                      "id": 33,
                      "name": "Manchester United",
                      "logo": "https://media.api-sports.io/football/teams/33.png"
                    },
                    "points": 60,
                    "goalsDiff": -1,
                    "group": "Premier League",
                    "form": "WWLLD",
                    "status": "same",
                    "description": "Promotion - Europa League (Group Stage: )",
                    "all": {
                      "played": 38,
                      "win": 18,
                      "draw": 6,
                      "lose": 14,
                      "goals": {
                        "for": 57,
                        "against": 58
                      }
                    },
                    "home": {
                      "played": 19,
                      "win": 10,
                      "draw": 3,
                      "lose": 6,
                      "goals": {
                        "for": 31,
                        "against": 28
                      }
                    },
                    "away": {
                      "played": 19,
                      "win": 8,
                      "draw": 3,
                      "lose": 8,
                      "goals": {
                        "for": 26,
                        "against": 30
                      }
                    },
                    "update": "2024-05-28T00:00:00+00:00"
                  },
                  {
                    "rank": 9,
                    "team": {
                      "id": 48,
                      "name": "West Ham",
                      "logo": "https://media.api-sports.io/football/teams/48.png"
                    },
                    "points": 52,
                    "goalsDiff": -14,
                    "group": "Premier League",
                    "form": "LWLDL",
                    "status": "same",
                    "description": undefined,
                    "all": {
                      "played": 38,
                      "win": 14,
                      "draw": 10,
                      "lose": 14,
                      "goals": {
                        "for": 60,
                        "against": 74
                      }
                    },
                    "home": {
                      "played": 19,
                      "win": 7,
                      "draw": 8,
                      "lose": 4,
                      "goals": {
                        "for": 31,
                        "against": 28
                      }
                    },
                    "away": {
                      "played": 19,
                      "win": 7,
                      "draw": 2,
                      "lose": 10,
                      "goals": {
                        "for": 29,
                        "against": 46
                      }
                    },
                    "update": "2024-05-28T00:00:00+00:00"
                  },
                  {
                    "rank": 10,
                    "team": {
                      "id": 52,
                      "name": "Crystal Palace",
                      "logo": "https://media.api-sports.io/football/teams/52.png"
                    },
                    "points": 49,
                    "goalsDiff": -1,
                    "group": "Premier League",
                    "form": "WWWDW",
                    "status": "same",
                    "description": undefined,
                    "all": {
                      "played": 38,
                      "win": 13,
                      "draw": 10,
                      "lose": 15,
                      "goals": {
                        "for": 57,
                        "against": 58
                      }
                    },
                    "home": {
                      "played": 19,
                      "win": 8,
                      "draw": 4,
                      "lose": 7,
                      "goals": {
                        "for": 37,
                        "against": 26
                      }
                    },
                    "away": {
                      "played": 19,
                      "win": 5,
                      "draw": 6,
                      "lose": 8,
                      "goals": {
                        "for": 20,
                        "against": 32
                      }
                    },
                    "update": "2024-05-28T00:00:00+00:00"
                  },
                  {
                    "rank": 11,
                    "team": {
                      "id": 51,
                      "name": "Brighton",
                      "logo": "https://media.api-sports.io/football/teams/51.png"
                    },
                    "points": 48,
                    "goalsDiff": -7,
                    "group": "Premier League",
                    "form": "LLDWL",
                    "status": "same",
                    "description": undefined,
                    "all": {
                      "played": 38,
                      "win": 12,
                      "draw": 12,
                      "lose": 14,
                      "goals": {
                        "for": 55,
                        "against": 62
                      }
                    },
                    "home": {
                      "played": 19,
                      "win": 8,
                      "draw": 6,
                      "lose": 5,
                      "goals": {
                        "for": 30,
                        "against": 27
                      }
                    },
                    "away": {
                      "played": 19,
                      "win": 4,
                      "draw": 6,
                      "lose": 9,
                      "goals": {
                        "for": 25,
                        "against": 35
                      }
                    },
                    "update": "2024-05-28T00:00:00+00:00"
                  },
                  {
                    "rank": 12,
                    "team": {
                      "id": 35,
                      "name": "Bournemouth",
                      "logo": "https://media.api-sports.io/football/teams/35.png"
                    },
                    "points": 48,
                    "goalsDiff": -13,
                    "group": "Premier League",
                    "form": "LLLWW",
                    "status": "same",
                    "description": undefined,
                    "all": {
                      "played": 38,
                      "win": 13,
                      "draw": 9,
                      "lose": 16,
                      "goals": {
                        "for": 54,
                        "against": 67
                      }
                    },
                    "home": {
                      "played": 19,
                      "win": 7,
                      "draw": 6,
                      "lose": 6,
                      "goals": {
                        "for": 27,
                        "against": 28
                      }
                    },
                    "away": {
                      "played": 19,
                      "win": 6,
                      "draw": 3,
                      "lose": 10,
                      "goals": {
                        "for": 27,
                        "against": 39
                      }
                    },
                    "update": "2024-05-28T00:00:00+00:00"
                  },
                  {
                    "rank": 13,
                    "team": {
                      "id": 36,
                      "name": "Fulham",
                      "logo": "https://media.api-sports.io/football/teams/36.png"
                    },
                    "points": 47,
                    "goalsDiff": -6,
                    "group": "Premier League",
                    "form": "WLDDL",
                    "status": "same",
                    "description": undefined,
                    "all": {
                      "played": 38,
                      "win": 13,
                      "draw": 8,
                      "lose": 17,
                      "goals": {
                        "for": 55,
                        "against": 61
                      }
                    },
                    "home": {
                      "played": 19,
                      "win": 9,
                      "draw": 2,
                      "lose": 8,
                      "goals": {
                        "for": 31,
                        "against": 24
                      }
                    },
                    "away": {
                      "played": 19,
                      "win": 4,
                      "draw": 6,
                      "lose": 9,
                      "goals": {
                        "for": 24,
                        "against": 37
                      }
                    },
                    "update": "2024-05-28T00:00:00+00:00"
                  },
                  {
                    "rank": 14,
                    "team": {
                      "id": 39,
                      "name": "Wolves",
                      "logo": "https://media.api-sports.io/football/teams/39.png"
                    },
                    "points": 46,
                    "goalsDiff": -15,
                    "group": "Premier League",
                    "form": "LLLWL",
                    "status": "same",
                    "description": undefined,
                    "all": {
                      "played": 38,
                      "win": 13,
                      "draw": 7,
                      "lose": 18,
                      "goals": {
                        "for": 50,
                        "against": 65
                      }
                    },
                    "home": {
                      "played": 19,
                      "win": 8,
                      "draw": 3,
                      "lose": 8,
                      "goals": {
                        "for": 26,
                        "against": 30
                      }
                    },
                    "away": {
                      "played": 19,
                      "win": 5,
                      "draw": 4,
                      "lose": 10,
                      "goals": {
                        "for": 24,
                        "against": 35
                      }
                    },
                    "update": "2024-05-28T00:00:00+00:00"
                  },
                  {
                    "rank": 15,
                    "team": {
                      "id": 45,
                      "name": "Everton",
                      "logo": "https://media.api-sports.io/football/teams/45.png"
                    },
                    "points": 40,
                    "goalsDiff": -11,
                    "group": "Premier League",
                    "form": "LWDWW",
                    "status": "same",
                    "description": undefined,
                    "all": {
                      "played": 38,
                      "win": 13,
                      "draw": 9,
                      "lose": 16,
                      "goals": {
                        "for": 40,
                        "against": 51
                      }
                    },
                    "home": {
                      "played": 19,
                      "win": 8,
                      "draw": 4,
                      "lose": 7,
                      "goals": {
                        "for": 22,
                        "against": 18
                      }
                    },
                    "away": {
                      "played": 19,
                      "win": 5,
                      "draw": 5,
                      "lose": 9,
                      "goals": {
                        "for": 18,
                        "against": 33
                      }
                    },
                    "update": "2024-05-28T00:00:00+00:00"
                  },
                  {
                    "rank": 16,
                    "team": {
                      "id": 55,
                      "name": "Brentford",
                      "logo": "https://media.api-sports.io/football/teams/55.png"
                    },
                    "points": 39,
                    "goalsDiff": -9,
                    "group": "Premier League",
                    "form": "LWDLW",
                    "status": "same",
                    "description": undefined,
                    "all": {
                      "played": 38,
                      "win": 10,
                      "draw": 9,
                      "lose": 19,
                      "goals": {
                        "for": 56,
                        "against": 65
                      }
                    },
                    "home": {
                      "played": 19,
                      "win": 5,
                      "draw": 7,
                      "lose": 7,
                      "goals": {
                        "for": 29,
                        "against": 34
                      }
                    },
                    "away": {
                      "played": 19,
                      "win": 5,
                      "draw": 2,
                      "lose": 12,
                      "goals": {
                        "for": 27,
                        "against": 31
                      }
                    },
                    "update": "2024-05-28T00:00:00+00:00"
                  },
                  {
                    "rank": 17,
                    "team": {
                      "id": 65,
                      "name": "Nottingham Forest",
                      "logo": "https://media.api-sports.io/football/teams/65.png"
                    },
                    "points": 32,
                    "goalsDiff": -18,
                    "group": "Premier League",
                    "form": "WLWLL",
                    "status": "same",
                    "description": undefined,
                    "all": {
                      "played": 38,
                      "win": 9,
                      "draw": 9,
                      "lose": 20,
                      "goals": {
                        "for": 49,
                        "against": 67
                      }
                    },
                    "home": {
                      "played": 19,
                      "win": 5,
                      "draw": 5,
                      "lose": 9,
                      "goals": {
                        "for": 27,
                        "against": 30
                      }
                    },
                    "away": {
                      "played": 19,
                      "win": 4,
                      "draw": 4,
                      "lose": 11,
                      "goals": {
                        "for": 22,
                        "against": 37
                      }
                    },
                    "update": "2024-05-28T00:00:00+00:00"
                  },
                  {
                    "rank": 18,
                    "team": {
                      "id": 1359,
                      "name": "Luton",
                      "logo": "https://media.api-sports.io/football/teams/1359.png"
                    },
                    "points": 26,
                    "goalsDiff": -33,
                    "group": "Premier League",
                    "form": "LLDLL",
                    "status": "same",
                    "description": "Relegation - Championship",
                    "all": {
                      "played": 38,
                      "win": 6,
                      "draw": 8,
                      "lose": 24,
                      "goals": {
                        "for": 52,
                        "against": 85
                      }
                    },
                    "home": {
                      "played": 19,
                      "win": 4,
                      "draw": 4,
                      "lose": 11,
                      "goals": {
                        "for": 28,
                        "against": 37
                      }
                    },
                    "away": {
                      "played": 19,
                      "win": 2,
                      "draw": 4,
                      "lose": 13,
                      "goals": {
                        "for": 24,
                        "against": 48
                      }
                    },
                    "update": "2024-05-28T00:00:00+00:00"
                  },
                  {
                    "rank": 19,
                    "team": {
                      "id": 44,
                      "name": "Burnley",
                      "logo": "https://media.api-sports.io/football/teams/44.png"
                    },
                    "points": 24,
                    "goalsDiff": -37,
                    "group": "Premier League",
                    "form": "LLLDW",
                    "status": "same",
                    "description": "Relegation - Championship",
                    "all": {
                      "played": 38,
                      "win": 5,
                      "draw": 9,
                      "lose": 24,
                      "goals": {
                        "for": 41,
                        "against": 78
                      }
                    },
                    "home": {
                      "played": 19,
                      "win": 2,
                      "draw": 4,
                      "lose": 13,
                      "goals": {
                        "for": 19,
                        "against": 43
                      }
                    },
                    "away": {
                      "played": 19,
                      "win": 3,
                      "draw": 5,
                      "lose": 11,
                      "goals": {
                        "for": 22,
                        "against": 35
                      }
                    },
                    "update": "2024-05-28T00:00:00+00:00"
                  },
                  {
                    "rank": 20,
                    "team": {
                      "id": 62,
                      "name": "Sheffield Utd",
                      "logo": "https://media.api-sports.io/football/teams/62.png"
                    },
                    "points": 16,
                    "goalsDiff": -69,
                    "group": "Premier League",
                    "form": "LLLLL",
                    "status": "same",
                    "description": "Relegation - Championship",
                    "all": {
                      "played": 38,
                      "win": 3,
                      "draw": 7,
                      "lose": 28,
                      "goals": {
                        "for": 35,
                        "against": 104
                      }
                    },
                    "home": {
                      "played": 19,
                      "win": 2,
                      "draw": 4,
                      "lose": 13,
                      "goals": {
                        "for": 19,
                        "against": 57
                      }
                    },
                    "away": {
                      "played": 19,
                      "win": 1,
                      "draw": 3,
                      "lose": 15,
                      "goals": {
                        "for": 16,
                        "against": 47
                      }
                    },
                    "update": "2024-05-28T00:00:00+00:00"
                  }
                ]
              ]
            }
          }
        ]
      },
      "headers": {
        "date": "Sun, 23 Nov 2025 10:55:02 GMT",
        "content-type": "application/json",
        "transfer-encoding": "chunked",
        "connection": "keep-alive",
        "server": "cloudflare",
        "vary": "Accept-Encoding",
        "access-control-allow-origin": "*",
        "access-control-allow-credentials": "True",
        "access-control-allow-methods": "GET, OPTIONS",
        "access-control-allow-headers": "x-rapidapi-key, x-apisports-key, x-rapidapi-host",
        "x-ratelimit-limit": "10",
        "x-ratelimit-remaining": "9",
        "x-ratelimit-requests-limit": "100",
        "x-ratelimit-requests-remaining": "89",
        "x-envoy-upstream-service-time": "13",
        "cache-control": "no-store, no-cache, must-revalidate",
        "pragma": "no-cache",
        "expires": "0",
        "strict-transport-security": "max-age=31536000; includeSubDomains",
        "cf-cache-status": "DYNAMIC",
        "nel": "{\"report_to\":\"cf-nel\",\"success_fraction\":0.0,\"max_age\":604800}",
        "report-to": "{\"group\":\"cf-nel\",\"max_age\":604800,\"endpoints\":[{\"url\":\"https://a.nel.cloudflare.com/report/v4?s=Z2VOJLGkOIRUIYnfvpVB1Hz0ySOq8UumK%2B3KJnIwtOXhSudzoR6pzkp%2Fa5qmMEZnTHxPR65OcQbiLOd6lz786bCkrOVoAKeMX%2BSvZUi2DqwE%2BrNtUpDMIQ%3D%3D\"}]}",
        "cf-ray": "9a3021c798deefdb-ARN"
      }
    }
  },
  {
    "request": {
      "method": "GET",
      "url": "https://v3.football.api-sports.io/fixtures",
      "headers": {
        "x-rapidapi-key": "52dd...5e7f",
        "x-rapidapi-host": "api-football-v1.p.rapidapi.com"
      },
      "queryParams": {
        "season": "2023",
        "team": "40"
      }
    },
    "response": {
      "status": 200,
      "data": {
        "get": "fixtures",
        "parameters": {
          "season": "2023",
          "team": "40"
        },
        "errors": [],
        "results": 63,
        "paging": {
          "current": 1,
          "total": 1
        },
        "response": [
          {
            "fixture": {
              "id": 1030318,
              "referee": "F. Mohamed",
              "timezone": "UTC",
              "date": "2023-07-30T09:00:00+00:00",
              "timestamp": 1690707600,
              "periods": {
                "first": 1690707600,
                "second": 1690711200
              },
              "venue": {
                "id": 3897,
                "name": "The National Stadium",
                "city": "Singapore"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 667,
              "name": "Friendlies Clubs",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/667.png",
              "flag": undefined,
              "season": 2023,
              "round": "Club Friendlies 1",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              },
              "away": {
                "id": 46,
                "name": "Leicester",
                "logo": "https://media.api-sports.io/football/teams/46.png",
                "winner": false
              }
            },
            "goals": {
              "home": 4,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 3,
                "away": 0
              },
              "fulltime": {
                "home": 4,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 1030324,
              "referee": "A. A'Qashah",
              "timezone": "UTC",
              "date": "2023-08-02T11:30:00+00:00",
              "timestamp": 1690975800,
              "periods": {
                "first": 1690975800,
                "second": 1690979400
              },
              "venue": {
                "id": 3897,
                "name": "The National Stadium",
                "city": "Singapore"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 667,
              "name": "Friendlies Clubs",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/667.png",
              "flag": undefined,
              "season": 2023,
              "round": "Club Friendlies 1",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": false
              },
              "away": {
                "id": 157,
                "name": "Bayern Munich",
                "logo": "https://media.api-sports.io/football/teams/157.png",
                "winner": true
              }
            },
            "goals": {
              "home": 3,
              "away": 4
            },
            "score": {
              "halftime": {
                "home": 2,
                "away": 2
              },
              "fulltime": {
                "home": 3,
                "away": 4
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 1030693,
              "referee": "L. Erbst",
              "timezone": "UTC",
              "date": "2023-07-19T16:30:00+00:00",
              "timestamp": 1689784200,
              "periods": {
                "first": 1689784200,
                "second": 1689787800
              },
              "venue": {
                "id": 11900,
                "name": "BBBank Wildpark",
                "city": "Karlsruhe"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 667,
              "name": "Friendlies Clubs",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/667.png",
              "flag": undefined,
              "season": 2023,
              "round": "Club Friendlies 1",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 785,
                "name": "Karlsruher SC",
                "logo": "https://media.api-sports.io/football/teams/785.png",
                "winner": false
              },
              "away": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              }
            },
            "goals": {
              "home": 2,
              "away": 4
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 1
              },
              "fulltime": {
                "home": 2,
                "away": 4
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 1030694,
              "referee": "M. Wilke",
              "timezone": "UTC",
              "date": "2023-07-24T11:00:00+00:00",
              "timestamp": 1690196400,
              "periods": {
                "first": 1690196400,
                "second": 1690200000
              },
              "venue": {
                "id": 18782,
                "name": "MS Technologie Arena",
                "city": "Villingen-Schwenningen"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 667,
              "name": "Friendlies Clubs",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/667.png",
              "flag": undefined,
              "season": 2023,
              "round": "Club Friendlies 1",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 178,
                "name": "SpVgg Greuther Furth",
                "logo": "https://media.api-sports.io/football/teams/178.png",
                "winner": undefined
              },
              "away": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": undefined
              }
            },
            "goals": {
              "home": 4,
              "away": 4
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 1
              },
              "fulltime": {
                "home": 4,
                "away": 4
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 1035045,
              "referee": "A. Taylor",
              "timezone": "UTC",
              "date": "2023-08-13T15:30:00+00:00",
              "timestamp": 1691940600,
              "periods": {
                "first": 1691940600,
                "second": 1691944200
              },
              "venue": {
                "id": 519,
                "name": "Stamford Bridge",
                "city": "London"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2023,
              "round": "Regular Season - 1",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": undefined
              },
              "away": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": undefined
              }
            },
            "goals": {
              "home": 1,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 1
              },
              "fulltime": {
                "home": 1,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 1035050,
              "referee": "T. Bramall",
              "timezone": "UTC",
              "date": "2023-08-19T14:00:00+00:00",
              "timestamp": 1692453600,
              "periods": {
                "first": 1692453600,
                "second": 1692457200
              },
              "venue": {
                "id": 550,
                "name": "Anfield",
                "city": "Liverpool"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2023,
              "round": "Regular Season - 2",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              },
              "away": {
                "id": 35,
                "name": "Bournemouth",
                "logo": "https://media.api-sports.io/football/teams/35.png",
                "winner": false
              }
            },
            "goals": {
              "home": 3,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 2,
                "away": 1
              },
              "fulltime": {
                "home": 3,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 1035065,
              "referee": "J. Brooks",
              "timezone": "UTC",
              "date": "2023-08-27T15:30:00+00:00",
              "timestamp": 1693150200,
              "periods": {
                "first": 1693150200,
                "second": 1693153800
              },
              "venue": {
                "id": 562,
                "name": "St. James' Park",
                "city": "Newcastle upon Tyne"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2023,
              "round": "Regular Season - 3",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 34,
                "name": "Newcastle",
                "logo": "https://media.api-sports.io/football/teams/34.png",
                "winner": false
              },
              "away": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              }
            },
            "goals": {
              "home": 1,
              "away": 2
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 0
              },
              "fulltime": {
                "home": 1,
                "away": 2
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 1035073,
              "referee": "S. Hooper",
              "timezone": "UTC",
              "date": "2023-09-03T13:00:00+00:00",
              "timestamp": 1693746000,
              "periods": {
                "first": 1693746000,
                "second": 1693749600
              },
              "venue": {
                "id": 550,
                "name": "Anfield",
                "city": "Liverpool"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2023,
              "round": "Regular Season - 4",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              },
              "away": {
                "id": 66,
                "name": "Aston Villa",
                "logo": "https://media.api-sports.io/football/teams/66.png",
                "winner": false
              }
            },
            "goals": {
              "home": 3,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 2,
                "away": 0
              },
              "fulltime": {
                "home": 3,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 1035086,
              "referee": "M. Oliver",
              "timezone": "UTC",
              "date": "2023-09-16T11:30:00+00:00",
              "timestamp": 1694863800,
              "periods": {
                "first": 1694863800,
                "second": 1694867400
              },
              "venue": {
                "id": 600,
                "name": "Molineux Stadium",
                "city": "Wolverhampton, West Midlands"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2023,
              "round": "Regular Season - 5",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 39,
                "name": "Wolves",
                "logo": "https://media.api-sports.io/football/teams/39.png",
                "winner": false
              },
              "away": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              }
            },
            "goals": {
              "home": 1,
              "away": 3
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 0
              },
              "fulltime": {
                "home": 1,
                "away": 3
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 1035093,
              "referee": "C. Kavanagh",
              "timezone": "UTC",
              "date": "2023-09-24T13:00:00+00:00",
              "timestamp": 1695560400,
              "periods": {
                "first": 1695560400,
                "second": 1695564000
              },
              "venue": {
                "id": 550,
                "name": "Anfield",
                "city": "Liverpool"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2023,
              "round": "Regular Season - 6",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              },
              "away": {
                "id": 48,
                "name": "West Ham",
                "logo": "https://media.api-sports.io/football/teams/48.png",
                "winner": false
              }
            },
            "goals": {
              "home": 3,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 1
              },
              "fulltime": {
                "home": 3,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 1035104,
              "referee": "S. Hooper",
              "timezone": "UTC",
              "date": "2023-09-30T16:30:00+00:00",
              "timestamp": 1696091400,
              "periods": {
                "first": 1696091400,
                "second": 1696095000
              },
              "venue": {
                "id": 593,
                "name": "Tottenham Hotspur Stadium",
                "city": "London"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2023,
              "round": "Regular Season - 7",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 47,
                "name": "Tottenham",
                "logo": "https://media.api-sports.io/football/teams/47.png",
                "winner": true
              },
              "away": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": false
              }
            },
            "goals": {
              "home": 2,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 1
              },
              "fulltime": {
                "home": 2,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 1035108,
              "referee": "A. Taylor",
              "timezone": "UTC",
              "date": "2023-10-08T13:00:00+00:00",
              "timestamp": 1696770000,
              "periods": {
                "first": 1696770000,
                "second": 1696773600
              },
              "venue": {
                "id": 508,
                "name": "The American Express Community Stadium",
                "city": "Falmer, East Sussex"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2023,
              "round": "Regular Season - 8",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 51,
                "name": "Brighton",
                "logo": "https://media.api-sports.io/football/teams/51.png",
                "winner": undefined
              },
              "away": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": undefined
              }
            },
            "goals": {
              "home": 2,
              "away": 2
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 2
              },
              "fulltime": {
                "home": 2,
                "away": 2
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 1035121,
              "referee": "C. Pawson",
              "timezone": "UTC",
              "date": "2023-10-21T11:30:00+00:00",
              "timestamp": 1697887800,
              "periods": {
                "first": 1697887800,
                "second": 1697891400
              },
              "venue": {
                "id": 550,
                "name": "Anfield",
                "city": "Liverpool"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2023,
              "round": "Regular Season - 9",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              },
              "away": {
                "id": 45,
                "name": "Everton",
                "logo": "https://media.api-sports.io/football/teams/45.png",
                "winner": false
              }
            },
            "goals": {
              "home": 2,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 2,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 1035133,
              "referee": "C. Kavanagh",
              "timezone": "UTC",
              "date": "2023-10-29T14:00:00+00:00",
              "timestamp": 1698588000,
              "periods": {
                "first": 1698588000,
                "second": 1698591600
              },
              "venue": {
                "id": 550,
                "name": "Anfield",
                "city": "Liverpool"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2023,
              "round": "Regular Season - 10",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              },
              "away": {
                "id": 65,
                "name": "Nottingham Forest",
                "logo": "https://media.api-sports.io/football/teams/65.png",
                "winner": false
              }
            },
            "goals": {
              "home": 3,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 2,
                "away": 0
              },
              "fulltime": {
                "home": 3,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 1035141,
              "referee": "A. Madley",
              "timezone": "UTC",
              "date": "2023-11-05T16:30:00+00:00",
              "timestamp": 1699201800,
              "periods": {
                "first": 1699201800,
                "second": 1699205400
              },
              "venue": {
                "id": 551,
                "name": "Kenilworth Road",
                "city": "Luton, Bedfordshire"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2023,
              "round": "Regular Season - 11",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 1359,
                "name": "Luton",
                "logo": "https://media.api-sports.io/football/teams/1359.png",
                "winner": undefined
              },
              "away": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": undefined
              }
            },
            "goals": {
              "home": 1,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 1,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 1035153,
              "referee": "P. Tierney",
              "timezone": "UTC",
              "date": "2023-11-12T14:00:00+00:00",
              "timestamp": 1699797600,
              "periods": {
                "first": 1699797600,
                "second": 1699801200
              },
              "venue": {
                "id": 550,
                "name": "Anfield",
                "city": "Liverpool"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2023,
              "round": "Regular Season - 12",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              },
              "away": {
                "id": 55,
                "name": "Brentford",
                "logo": "https://media.api-sports.io/football/teams/55.png",
                "winner": false
              }
            },
            "goals": {
              "home": 3,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 0
              },
              "fulltime": {
                "home": 3,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 1035299,
              "referee": "C. Kavanagh",
              "timezone": "UTC",
              "date": "2023-11-25T12:30:00+00:00",
              "timestamp": 1700915400,
              "periods": {
                "first": 1700915400,
                "second": 1700919000
              },
              "venue": {
                "id": 555,
                "name": "Etihad Stadium",
                "city": "Manchester"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2023,
              "round": "Regular Season - 13",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 50,
                "name": "Manchester City",
                "logo": "https://media.api-sports.io/football/teams/50.png",
                "winner": undefined
              },
              "away": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": undefined
              }
            },
            "goals": {
              "home": 1,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 0
              },
              "fulltime": {
                "home": 1,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 1035309,
              "referee": "S. Attwell",
              "timezone": "UTC",
              "date": "2023-12-03T14:00:00+00:00",
              "timestamp": 1701612000,
              "periods": {
                "first": 1701612000,
                "second": 1701615600
              },
              "venue": {
                "id": 550,
                "name": "Anfield",
                "city": "Liverpool"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2023,
              "round": "Regular Season - 14",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              },
              "away": {
                "id": 36,
                "name": "Fulham",
                "logo": "https://media.api-sports.io/football/teams/36.png",
                "winner": false
              }
            },
            "goals": {
              "home": 4,
              "away": 3
            },
            "score": {
              "halftime": {
                "home": 2,
                "away": 2
              },
              "fulltime": {
                "home": 4,
                "away": 3
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 1035319,
              "referee": "S. Hooper",
              "timezone": "UTC",
              "date": "2023-12-06T19:30:00+00:00",
              "timestamp": 1701891000,
              "periods": {
                "first": 1701891000,
                "second": 1701894600
              },
              "venue": {
                "id": 581,
                "name": "Bramall Lane",
                "city": "Sheffield"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2023,
              "round": "Regular Season - 15",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 62,
                "name": "Sheffield Utd",
                "logo": "https://media.api-sports.io/football/teams/62.png",
                "winner": false
              },
              "away": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              }
            },
            "goals": {
              "home": 0,
              "away": 2
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 1
              },
              "fulltime": {
                "home": 0,
                "away": 2
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 1035326,
              "referee": "A. Madley",
              "timezone": "UTC",
              "date": "2023-12-09T12:30:00+00:00",
              "timestamp": 1702125000,
              "periods": {
                "first": 1702125000,
                "second": 1702128600
              },
              "venue": {
                "id": 525,
                "name": "Selhurst Park",
                "city": "London"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2023,
              "round": "Regular Season - 16",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 52,
                "name": "Crystal Palace",
                "logo": "https://media.api-sports.io/football/teams/52.png",
                "winner": false
              },
              "away": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              }
            },
            "goals": {
              "home": 1,
              "away": 2
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 1,
                "away": 2
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 1035339,
              "referee": "M. Oliver",
              "timezone": "UTC",
              "date": "2023-12-17T16:30:00+00:00",
              "timestamp": 1702830600,
              "periods": {
                "first": 1702830600,
                "second": 1702834200
              },
              "venue": {
                "id": 550,
                "name": "Anfield",
                "city": "Liverpool"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2023,
              "round": "Regular Season - 17",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": undefined
              },
              "away": {
                "id": 33,
                "name": "Manchester United",
                "logo": "https://media.api-sports.io/football/teams/33.png",
                "winner": undefined
              }
            },
            "goals": {
              "home": 0,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 0,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 1035347,
              "referee": "C. Kavanagh",
              "timezone": "UTC",
              "date": "2023-12-23T17:30:00+00:00",
              "timestamp": 1703352600,
              "periods": {
                "first": 1703352600,
                "second": 1703356200
              },
              "venue": {
                "id": 550,
                "name": "Anfield",
                "city": "Liverpool"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2023,
              "round": "Regular Season - 18",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": undefined
              },
              "away": {
                "id": 42,
                "name": "Arsenal",
                "logo": "https://media.api-sports.io/football/teams/42.png",
                "winner": undefined
              }
            },
            "goals": {
              "home": 1,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 1
              },
              "fulltime": {
                "home": 1,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 1035358,
              "referee": "P. Tierney",
              "timezone": "UTC",
              "date": "2023-12-26T17:30:00+00:00",
              "timestamp": 1703611800,
              "periods": {
                "first": 1703611800,
                "second": 1703615400
              },
              "venue": {
                "id": 512,
                "name": "Turf Moor",
                "city": "Burnley"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2023,
              "round": "Regular Season - 19",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 44,
                "name": "Burnley",
                "logo": "https://media.api-sports.io/football/teams/44.png",
                "winner": false
              },
              "away": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              }
            },
            "goals": {
              "home": 0,
              "away": 2
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 1
              },
              "fulltime": {
                "home": 0,
                "away": 2
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 1035367,
              "referee": "A. Taylor",
              "timezone": "UTC",
              "date": "2024-01-01T20:00:00+00:00",
              "timestamp": 1704139200,
              "periods": {
                "first": 1704139200,
                "second": 1704142800
              },
              "venue": {
                "id": 550,
                "name": "Anfield",
                "city": "Liverpool"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2023,
              "round": "Regular Season - 20",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              },
              "away": {
                "id": 34,
                "name": "Newcastle",
                "logo": "https://media.api-sports.io/football/teams/34.png",
                "winner": false
              }
            },
            "goals": {
              "home": 4,
              "away": 2
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 4,
                "away": 2
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 1035374,
              "referee": "A. Madley",
              "timezone": "UTC",
              "date": "2024-01-21T16:30:00+00:00",
              "timestamp": 1705854600,
              "periods": {
                "first": 1705854600,
                "second": 1705858200
              },
              "venue": {
                "id": 504,
                "name": "Vitality Stadium",
                "city": "Bournemouth, Dorset"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2023,
              "round": "Regular Season - 21",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 35,
                "name": "Bournemouth",
                "logo": "https://media.api-sports.io/football/teams/35.png",
                "winner": false
              },
              "away": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              }
            },
            "goals": {
              "home": 0,
              "away": 4
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 0,
                "away": 4
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 1035392,
              "referee": "P. Tierney",
              "timezone": "UTC",
              "date": "2024-01-31T20:15:00+00:00",
              "timestamp": 1706732100,
              "periods": {
                "first": 1706732100,
                "second": 1706735700
              },
              "venue": {
                "id": 550,
                "name": "Anfield",
                "city": "Liverpool"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2023,
              "round": "Regular Season - 22",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              },
              "away": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": false
              }
            },
            "goals": {
              "home": 4,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 2,
                "away": 0
              },
              "fulltime": {
                "home": 4,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 1035395,
              "referee": "A. Taylor",
              "timezone": "UTC",
              "date": "2024-02-04T16:30:00+00:00",
              "timestamp": 1707064200,
              "periods": {
                "first": 1707064200,
                "second": 1707067800
              },
              "venue": {
                "id": 494,
                "name": "Emirates Stadium",
                "city": "London"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2023,
              "round": "Regular Season - 23",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 42,
                "name": "Arsenal",
                "logo": "https://media.api-sports.io/football/teams/42.png",
                "winner": true
              },
              "away": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": false
              }
            },
            "goals": {
              "home": 3,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 1
              },
              "fulltime": {
                "home": 3,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 1035407,
              "referee": "T. Robinson",
              "timezone": "UTC",
              "date": "2024-02-10T15:00:00+00:00",
              "timestamp": 1707577200,
              "periods": {
                "first": 1707577200,
                "second": 1707580800
              },
              "venue": {
                "id": 550,
                "name": "Anfield",
                "city": "Liverpool"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2023,
              "round": "Regular Season - 24",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              },
              "away": {
                "id": 44,
                "name": "Burnley",
                "logo": "https://media.api-sports.io/football/teams/44.png",
                "winner": false
              }
            },
            "goals": {
              "home": 3,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 1
              },
              "fulltime": {
                "home": 3,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 1035414,
              "referee": "M. Oliver",
              "timezone": "UTC",
              "date": "2024-02-17T12:30:00+00:00",
              "timestamp": 1708173000,
              "periods": {
                "first": 1708173000,
                "second": 1708176600
              },
              "venue": {
                "id": 10503,
                "name": "Gtech Community Stadium",
                "city": "Brentford, Middlesex"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2023,
              "round": "Regular Season - 25",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 55,
                "name": "Brentford",
                "logo": "https://media.api-sports.io/football/teams/55.png",
                "winner": false
              },
              "away": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              }
            },
            "goals": {
              "home": 1,
              "away": 4
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 1
              },
              "fulltime": {
                "home": 1,
                "away": 4
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 1035430,
              "referee": "A. Madley",
              "timezone": "UTC",
              "date": "2024-02-21T19:30:00+00:00",
              "timestamp": 1708543800,
              "periods": {
                "first": 1708543800,
                "second": 1708547400
              },
              "venue": {
                "id": 550,
                "name": "Anfield",
                "city": "Liverpool"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2023,
              "round": "Regular Season - 26",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              },
              "away": {
                "id": 1359,
                "name": "Luton",
                "logo": "https://media.api-sports.io/football/teams/1359.png",
                "winner": false
              }
            },
            "goals": {
              "home": 4,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 1
              },
              "fulltime": {
                "home": 4,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 1035441,
              "referee": "P. Tierney",
              "timezone": "UTC",
              "date": "2024-03-02T15:00:00+00:00",
              "timestamp": 1709391600,
              "periods": {
                "first": 1709391600,
                "second": 1709395200
              },
              "venue": {
                "id": 566,
                "name": "The City Ground",
                "city": "Nottingham, Nottinghamshire"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2023,
              "round": "Regular Season - 27",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 65,
                "name": "Nottingham Forest",
                "logo": "https://media.api-sports.io/football/teams/65.png",
                "winner": false
              },
              "away": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              }
            },
            "goals": {
              "home": 0,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 0,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 1035450,
              "referee": "M. Oliver",
              "timezone": "UTC",
              "date": "2024-03-10T15:45:00+00:00",
              "timestamp": 1710085500,
              "periods": {
                "first": 1710085500,
                "second": 1710089100
              },
              "venue": {
                "id": 550,
                "name": "Anfield",
                "city": "Liverpool"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2023,
              "round": "Regular Season - 28",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": undefined
              },
              "away": {
                "id": 50,
                "name": "Manchester City",
                "logo": "https://media.api-sports.io/football/teams/50.png",
                "winner": undefined
              }
            },
            "goals": {
              "home": 1,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 1
              },
              "fulltime": {
                "home": 1,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 1035458,
              "referee": "A. Madley",
              "timezone": "UTC",
              "date": "2024-04-24T19:00:00+00:00",
              "timestamp": 1713985200,
              "periods": {
                "first": 1713985200,
                "second": 1713988800
              },
              "venue": {
                "id": 8560,
                "name": "Goodison Park",
                "city": "Liverpool"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2023,
              "round": "Regular Season - 29",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 45,
                "name": "Everton",
                "logo": "https://media.api-sports.io/football/teams/45.png",
                "winner": true
              },
              "away": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": false
              }
            },
            "goals": {
              "home": 2,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 0
              },
              "fulltime": {
                "home": 2,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 1035468,
              "referee": "D. Coote",
              "timezone": "UTC",
              "date": "2024-03-31T13:00:00+00:00",
              "timestamp": 1711890000,
              "periods": {
                "first": 1711890000,
                "second": 1711893600
              },
              "venue": {
                "id": 550,
                "name": "Anfield",
                "city": "Liverpool"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2023,
              "round": "Regular Season - 30",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              },
              "away": {
                "id": 51,
                "name": "Brighton",
                "logo": "https://media.api-sports.io/football/teams/51.png",
                "winner": false
              }
            },
            "goals": {
              "home": 2,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 1
              },
              "fulltime": {
                "home": 2,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 1035482,
              "referee": "S. Attwell",
              "timezone": "UTC",
              "date": "2024-04-04T18:30:00+00:00",
              "timestamp": 1712255400,
              "periods": {
                "first": 1712255400,
                "second": 1712259000
              },
              "venue": {
                "id": 550,
                "name": "Anfield",
                "city": "Liverpool"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2023,
              "round": "Regular Season - 31",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              },
              "away": {
                "id": 62,
                "name": "Sheffield Utd",
                "logo": "https://media.api-sports.io/football/teams/62.png",
                "winner": false
              }
            },
            "goals": {
              "home": 3,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 0
              },
              "fulltime": {
                "home": 3,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 1035490,
              "referee": "A. Taylor",
              "timezone": "UTC",
              "date": "2024-04-07T14:30:00+00:00",
              "timestamp": 1712500200,
              "periods": {
                "first": 1712500200,
                "second": 1712503800
              },
              "venue": {
                "id": 556,
                "name": "Old Trafford",
                "city": "Manchester"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2023,
              "round": "Regular Season - 32",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 33,
                "name": "Manchester United",
                "logo": "https://media.api-sports.io/football/teams/33.png",
                "winner": undefined
              },
              "away": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": undefined
              }
            },
            "goals": {
              "home": 2,
              "away": 2
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 1
              },
              "fulltime": {
                "home": 2,
                "away": 2
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 1035499,
              "referee": "C. Kavanagh",
              "timezone": "UTC",
              "date": "2024-04-14T13:00:00+00:00",
              "timestamp": 1713099600,
              "periods": {
                "first": 1713099600,
                "second": 1713103200
              },
              "venue": {
                "id": 550,
                "name": "Anfield",
                "city": "Liverpool"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2023,
              "round": "Regular Season - 33",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": false
              },
              "away": {
                "id": 52,
                "name": "Crystal Palace",
                "logo": "https://media.api-sports.io/football/teams/52.png",
                "winner": true
              }
            },
            "goals": {
              "home": 0,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 1
              },
              "fulltime": {
                "home": 0,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 1035508,
              "referee": "C. Pawson",
              "timezone": "UTC",
              "date": "2024-04-21T15:30:00+00:00",
              "timestamp": 1713713400,
              "periods": {
                "first": 1713713400,
                "second": 1713717000
              },
              "venue": {
                "id": 535,
                "name": "Craven Cottage",
                "city": "London"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2023,
              "round": "Regular Season - 34",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 36,
                "name": "Fulham",
                "logo": "https://media.api-sports.io/football/teams/36.png",
                "winner": false
              },
              "away": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              }
            },
            "goals": {
              "home": 1,
              "away": 3
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 1
              },
              "fulltime": {
                "home": 1,
                "away": 3
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 1035522,
              "referee": "A. Taylor",
              "timezone": "UTC",
              "date": "2024-04-27T11:30:00+00:00",
              "timestamp": 1714217400,
              "periods": {
                "first": 1714217400,
                "second": 1714221000
              },
              "venue": {
                "id": 598,
                "name": "London Stadium",
                "city": "London"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2023,
              "round": "Regular Season - 35",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 48,
                "name": "West Ham",
                "logo": "https://media.api-sports.io/football/teams/48.png",
                "winner": undefined
              },
              "away": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": undefined
              }
            },
            "goals": {
              "home": 2,
              "away": 2
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 0
              },
              "fulltime": {
                "home": 2,
                "away": 2
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 1035530,
              "referee": "P. Tierney",
              "timezone": "UTC",
              "date": "2024-05-05T15:30:00+00:00",
              "timestamp": 1714923000,
              "periods": {
                "first": 1714923000,
                "second": 1714926600
              },
              "venue": {
                "id": 550,
                "name": "Anfield",
                "city": "Liverpool"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2023,
              "round": "Regular Season - 36",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              },
              "away": {
                "id": 47,
                "name": "Tottenham",
                "logo": "https://media.api-sports.io/football/teams/47.png",
                "winner": false
              }
            },
            "goals": {
              "home": 4,
              "away": 2
            },
            "score": {
              "halftime": {
                "home": 2,
                "away": 0
              },
              "fulltime": {
                "home": 4,
                "away": 2
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 1035535,
              "referee": "S. Hooper",
              "timezone": "UTC",
              "date": "2024-05-13T19:00:00+00:00",
              "timestamp": 1715626800,
              "periods": {
                "first": 1715626800,
                "second": 1715630400
              },
              "venue": {
                "id": 495,
                "name": "Villa Park",
                "city": "Birmingham"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2023,
              "round": "Regular Season - 37",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 66,
                "name": "Aston Villa",
                "logo": "https://media.api-sports.io/football/teams/66.png",
                "winner": undefined
              },
              "away": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": undefined
              }
            },
            "goals": {
              "home": 3,
              "away": 3
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 2
              },
              "fulltime": {
                "home": 3,
                "away": 3
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 1035550,
              "referee": "C. Kavanagh",
              "timezone": "UTC",
              "date": "2024-05-19T15:00:00+00:00",
              "timestamp": 1716130800,
              "periods": {
                "first": 1716130800,
                "second": 1716134400
              },
              "venue": {
                "id": 550,
                "name": "Anfield",
                "city": "Liverpool"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2023,
              "round": "Regular Season - 38",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              },
              "away": {
                "id": 39,
                "name": "Wolves",
                "logo": "https://media.api-sports.io/football/teams/39.png",
                "winner": false
              }
            },
            "goals": {
              "home": 2,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 2,
                "away": 0
              },
              "fulltime": {
                "home": 2,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 1058328,
              "referee": undefined,
              "timezone": "UTC",
              "date": "2023-08-07T18:00:00+00:00",
              "timestamp": 1691431200,
              "periods": {
                "first": 1691431200,
                "second": 1691434800
              },
              "venue": {
                "id": 574,
                "name": "Deepdale",
                "city": "Preston"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 667,
              "name": "Friendlies Clubs",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/667.png",
              "flag": undefined,
              "season": 2023,
              "round": "Club Friendlies 1",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              },
              "away": {
                "id": 181,
                "name": "SV Darmstadt 98",
                "logo": "https://media.api-sports.io/football/teams/181.png",
                "winner": false
              }
            },
            "goals": {
              "home": 3,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 2,
                "away": 1
              },
              "fulltime": {
                "home": 3,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 1125711,
              "referee": "T. Robinson",
              "timezone": "UTC",
              "date": "2023-09-27T18:45:00+00:00",
              "timestamp": 1695840300,
              "periods": {
                "first": 1695840300,
                "second": 1695843900
              },
              "venue": {
                "id": 550,
                "name": "Anfield",
                "city": "Liverpool"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 48,
              "name": "League Cup",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/48.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2023,
              "round": "3rd Round",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              },
              "away": {
                "id": 46,
                "name": "Leicester",
                "logo": "https://media.api-sports.io/football/teams/46.png",
                "winner": false
              }
            },
            "goals": {
              "home": 3,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 1
              },
              "fulltime": {
                "home": 3,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 1126337,
              "referee": "M. Di Bello",
              "timezone": "UTC",
              "date": "2023-09-21T16:45:00+00:00",
              "timestamp": 1695314700,
              "periods": {
                "first": 1695314700,
                "second": 1695318300
              },
              "venue": {
                "id": undefined,
                "name": "Raiffeisen Arena",
                "city": "Linz"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 3,
              "name": "UEFA Europa League",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/3.png",
              "flag": undefined,
              "season": 2023,
              "round": "Group Stage - 1",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 1026,
                "name": "Lask Linz",
                "logo": "https://media.api-sports.io/football/teams/1026.png",
                "winner": false
              },
              "away": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              }
            },
            "goals": {
              "home": 1,
              "away": 3
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 0
              },
              "fulltime": {
                "home": 1,
                "away": 3
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 1126360,
              "referee": "M. Krogh",
              "timezone": "UTC",
              "date": "2023-10-05T19:00:00+00:00",
              "timestamp": 1696532400,
              "periods": {
                "first": 1696532400,
                "second": 1696536000
              },
              "venue": {
                "id": 550,
                "name": "Anfield",
                "city": "Liverpool"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 3,
              "name": "UEFA Europa League",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/3.png",
              "flag": undefined,
              "season": 2023,
              "round": "Group Stage - 2",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              },
              "away": {
                "id": 1393,
                "name": "Union St. Gilloise",
                "logo": "https://media.api-sports.io/football/teams/1393.png",
                "winner": false
              }
            },
            "goals": {
              "home": 2,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 0
              },
              "fulltime": {
                "home": 2,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 1126378,
              "referee": "R. Obrenović",
              "timezone": "UTC",
              "date": "2023-10-26T19:00:00+00:00",
              "timestamp": 1698346800,
              "periods": {
                "first": 1698346800,
                "second": 1698350400
              },
              "venue": {
                "id": 550,
                "name": "Anfield",
                "city": "Liverpool"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 3,
              "name": "UEFA Europa League",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/3.png",
              "flag": undefined,
              "season": 2023,
              "round": "Group Stage - 3",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              },
              "away": {
                "id": 96,
                "name": "Toulouse",
                "logo": "https://media.api-sports.io/football/teams/96.png",
                "winner": false
              }
            },
            "goals": {
              "home": 5,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 3,
                "away": 1
              },
              "fulltime": {
                "home": 5,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 1126386,
              "referee": "G. Kabakov",
              "timezone": "UTC",
              "date": "2023-11-09T17:45:00+00:00",
              "timestamp": 1699551900,
              "periods": {
                "first": 1699551900,
                "second": 1699555500
              },
              "venue": {
                "id": 682,
                "name": "Stadium de Toulouse",
                "city": "Toulouse"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 3,
              "name": "UEFA Europa League",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/3.png",
              "flag": undefined,
              "season": 2023,
              "round": "Group Stage - 4",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 96,
                "name": "Toulouse",
                "logo": "https://media.api-sports.io/football/teams/96.png",
                "winner": true
              },
              "away": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": false
              }
            },
            "goals": {
              "home": 3,
              "away": 2
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 0
              },
              "fulltime": {
                "home": 3,
                "away": 2
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 1126409,
              "referee": "U. Schnyder",
              "timezone": "UTC",
              "date": "2023-11-30T20:00:00+00:00",
              "timestamp": 1701374400,
              "periods": {
                "first": 1701374400,
                "second": 1701378000
              },
              "venue": {
                "id": 550,
                "name": "Anfield",
                "city": "Liverpool"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 3,
              "name": "UEFA Europa League",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/3.png",
              "flag": undefined,
              "season": 2023,
              "round": "Group Stage - 5",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              },
              "away": {
                "id": 1026,
                "name": "Lask Linz",
                "logo": "https://media.api-sports.io/football/teams/1026.png",
                "winner": false
              }
            },
            "goals": {
              "home": 4,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 2,
                "away": 0
              },
              "fulltime": {
                "home": 4,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 1126416,
              "referee": "O. Grinfeeld",
              "timezone": "UTC",
              "date": "2023-12-14T17:45:00+00:00",
              "timestamp": 1702575900,
              "periods": {
                "first": 1702575900,
                "second": 1702579500
              },
              "venue": {
                "id": undefined,
                "name": "Lotto Park",
                "city": "Brussel"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 3,
              "name": "UEFA Europa League",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/3.png",
              "flag": undefined,
              "season": 2023,
              "round": "Group Stage - 6",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 1393,
                "name": "Union St. Gilloise",
                "logo": "https://media.api-sports.io/football/teams/1393.png",
                "winner": true
              },
              "away": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": false
              }
            },
            "goals": {
              "home": 2,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 2,
                "away": 1
              },
              "fulltime": {
                "home": 2,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 1136340,
              "referee": "J. Brooks",
              "timezone": "UTC",
              "date": "2023-11-01T19:45:00+00:00",
              "timestamp": 1698867900,
              "periods": {
                "first": 1698867900,
                "second": 1698871500
              },
              "venue": {
                "id": 504,
                "name": "Vitality Stadium",
                "city": "Bournemouth, Dorset"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 48,
              "name": "League Cup",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/48.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2023,
              "round": "Round of 16",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 35,
                "name": "Bournemouth",
                "logo": "https://media.api-sports.io/football/teams/35.png",
                "winner": false
              },
              "away": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              }
            },
            "goals": {
              "home": 1,
              "away": 2
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 1
              },
              "fulltime": {
                "home": 1,
                "away": 2
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 1141107,
              "referee": "T. Robinson",
              "timezone": "UTC",
              "date": "2023-12-20T20:00:00+00:00",
              "timestamp": 1703102400,
              "periods": {
                "first": 1703102400,
                "second": 1703106000
              },
              "venue": {
                "id": 550,
                "name": "Anfield",
                "city": "Liverpool"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 48,
              "name": "League Cup",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/48.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2023,
              "round": "Quarter-finals",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              },
              "away": {
                "id": 48,
                "name": "West Ham",
                "logo": "https://media.api-sports.io/football/teams/48.png",
                "winner": false
              }
            },
            "goals": {
              "home": 5,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 0
              },
              "fulltime": {
                "home": 5,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 1145549,
              "referee": "J. Brooks",
              "timezone": "UTC",
              "date": "2024-01-07T16:30:00+00:00",
              "timestamp": 1704645000,
              "periods": {
                "first": 1704645000,
                "second": 1704648600
              },
              "venue": {
                "id": 494,
                "name": "Emirates Stadium",
                "city": "London"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 45,
              "name": "FA Cup",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/45.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2023,
              "round": "3rd Round",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 42,
                "name": "Arsenal",
                "logo": "https://media.api-sports.io/football/teams/42.png",
                "winner": false
              },
              "away": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              }
            },
            "goals": {
              "home": 0,
              "away": 2
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 0,
                "away": 2
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 1150583,
              "referee": "D. Coote",
              "timezone": "UTC",
              "date": "2024-01-10T20:00:00+00:00",
              "timestamp": 1704916800,
              "periods": {
                "first": 1704916800,
                "second": 1704920400
              },
              "venue": {
                "id": 550,
                "name": "Anfield",
                "city": "Liverpool"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 48,
              "name": "League Cup",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/48.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2023,
              "round": "Semi-finals",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              },
              "away": {
                "id": 36,
                "name": "Fulham",
                "logo": "https://media.api-sports.io/football/teams/36.png",
                "winner": false
              }
            },
            "goals": {
              "home": 2,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 1
              },
              "fulltime": {
                "home": 2,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 1150584,
              "referee": "S. Hooper",
              "timezone": "UTC",
              "date": "2024-01-24T20:00:00+00:00",
              "timestamp": 1706126400,
              "periods": {
                "first": 1706126400,
                "second": 1706130000
              },
              "venue": {
                "id": 535,
                "name": "Craven Cottage",
                "city": "London"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 48,
              "name": "League Cup",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/48.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2023,
              "round": "Semi-finals",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 36,
                "name": "Fulham",
                "logo": "https://media.api-sports.io/football/teams/36.png",
                "winner": undefined
              },
              "away": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": undefined
              }
            },
            "goals": {
              "home": 1,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 1
              },
              "fulltime": {
                "home": 1,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 1161125,
              "referee": "S. Barrott",
              "timezone": "UTC",
              "date": "2024-01-28T14:30:00+00:00",
              "timestamp": 1706452200,
              "periods": {
                "first": 1706452200,
                "second": 1706455800
              },
              "venue": {
                "id": 550,
                "name": "Anfield",
                "city": "Liverpool"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 45,
              "name": "FA Cup",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/45.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2023,
              "round": "4th Round",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              },
              "away": {
                "id": 71,
                "name": "Norwich",
                "logo": "https://media.api-sports.io/football/teams/71.png",
                "winner": false
              }
            },
            "goals": {
              "home": 5,
              "away": 2
            },
            "score": {
              "halftime": {
                "home": 2,
                "away": 1
              },
              "fulltime": {
                "home": 5,
                "away": 2
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 1168059,
              "referee": "C. Kavanagh",
              "timezone": "UTC",
              "date": "2024-02-25T15:00:00+00:00",
              "timestamp": 1708873200,
              "periods": {
                "first": 1708873200,
                "second": 1708876800
              },
              "venue": {
                "id": 489,
                "name": "Wembley Stadium",
                "city": "London"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 48,
              "name": "League Cup",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/48.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2023,
              "round": "Final",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": false
              },
              "away": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              }
            },
            "goals": {
              "home": 0,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 0,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 1171748,
              "referee": "C. Pawson",
              "timezone": "UTC",
              "date": "2024-02-28T20:00:00+00:00",
              "timestamp": 1709150400,
              "periods": {
                "first": 1709150400,
                "second": 1709154000
              },
              "venue": {
                "id": 550,
                "name": "Anfield",
                "city": "Liverpool"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 45,
              "name": "FA Cup",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/45.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2023,
              "round": "5th Round",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              },
              "away": {
                "id": 41,
                "name": "Southampton",
                "logo": "https://media.api-sports.io/football/teams/41.png",
                "winner": false
              }
            },
            "goals": {
              "home": 3,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 0
              },
              "fulltime": {
                "home": 3,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 1175847,
              "referee": "José Sánchez",
              "timezone": "UTC",
              "date": "2024-03-07T17:45:00+00:00",
              "timestamp": 1709833500,
              "periods": {
                "first": 1709833500,
                "second": 1709837100
              },
              "venue": {
                "id": 19513,
                "name": "epet ARENA",
                "city": "Praha"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 3,
              "name": "UEFA Europa League",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/3.png",
              "flag": undefined,
              "season": 2023,
              "round": "Round of 16",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 628,
                "name": "Sparta Praha",
                "logo": "https://media.api-sports.io/football/teams/628.png",
                "winner": false
              },
              "away": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              }
            },
            "goals": {
              "home": 1,
              "away": 5
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 3
              },
              "fulltime": {
                "home": 1,
                "away": 5
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 1175848,
              "referee": "Artur Soares Dias",
              "timezone": "UTC",
              "date": "2024-03-14T20:00:00+00:00",
              "timestamp": 1710446400,
              "periods": {
                "first": 1710446400,
                "second": 1710450000
              },
              "venue": {
                "id": 550,
                "name": "Anfield",
                "city": "Liverpool"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 3,
              "name": "UEFA Europa League",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/3.png",
              "flag": undefined,
              "season": 2023,
              "round": "Round of 16",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              },
              "away": {
                "id": 628,
                "name": "Sparta Praha",
                "logo": "https://media.api-sports.io/football/teams/628.png",
                "winner": false
              }
            },
            "goals": {
              "home": 6,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 4,
                "away": 1
              },
              "fulltime": {
                "home": 6,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 1180025,
              "referee": "J. Brooks",
              "timezone": "UTC",
              "date": "2024-03-17T15:30:00+00:00",
              "timestamp": 1710689400,
              "periods": {
                "first": 1710689400,
                "second": 1710693000
              },
              "venue": {
                "id": 556,
                "name": "Old Trafford",
                "city": "Manchester"
              },
              "status": {
                "long": "Match Finished",
                "short": "AET",
                "elapsed": 120,
                "extra": undefined
              }
            },
            "league": {
              "id": 45,
              "name": "FA Cup",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/45.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2023,
              "round": "Quarter-finals",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 33,
                "name": "Manchester United",
                "logo": "https://media.api-sports.io/football/teams/33.png",
                "winner": true
              },
              "away": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": false
              }
            },
            "goals": {
              "home": 4,
              "away": 3
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 2
              },
              "fulltime": {
                "home": 2,
                "away": 2
              },
              "extratime": {
                "home": 2,
                "away": 1
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 1184826,
              "referee": "H. Meler",
              "timezone": "UTC",
              "date": "2024-04-11T19:00:00+00:00",
              "timestamp": 1712862000,
              "periods": {
                "first": 1712862000,
                "second": 1712865600
              },
              "venue": {
                "id": 550,
                "name": "Anfield",
                "city": "Liverpool"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 3,
              "name": "UEFA Europa League",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/3.png",
              "flag": undefined,
              "season": 2023,
              "round": "Quarter-finals",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": false
              },
              "away": {
                "id": 499,
                "name": "Atalanta",
                "logo": "https://media.api-sports.io/football/teams/499.png",
                "winner": true
              }
            },
            "goals": {
              "home": 0,
              "away": 3
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 1
              },
              "fulltime": {
                "home": 0,
                "away": 3
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 1184827,
              "referee": "F. Letexier",
              "timezone": "UTC",
              "date": "2024-04-18T19:00:00+00:00",
              "timestamp": 1713466800,
              "periods": {
                "first": 1713466800,
                "second": 1713470400
              },
              "venue": {
                "id": 879,
                "name": "Gewiss Stadium",
                "city": "Bergamo"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 3,
              "name": "UEFA Europa League",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/3.png",
              "flag": undefined,
              "season": 2023,
              "round": "Quarter-finals",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 499,
                "name": "Atalanta",
                "logo": "https://media.api-sports.io/football/teams/499.png",
                "winner": false
              },
              "away": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              }
            },
            "goals": {
              "home": 0,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 1
              },
              "fulltime": {
                "home": 0,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          }
        ]
      },
      "headers": {
        "date": "Sun, 23 Nov 2025 10:56:37 GMT",
        "content-type": "application/json",
        "transfer-encoding": "chunked",
        "connection": "keep-alive",
        "server": "cloudflare",
        "vary": "Accept-Encoding",
        "access-control-allow-origin": "*",
        "access-control-allow-credentials": "True",
        "access-control-allow-methods": "GET, OPTIONS",
        "access-control-allow-headers": "x-rapidapi-key, x-apisports-key, x-rapidapi-host",
        "x-ratelimit-limit": "10",
        "x-ratelimit-remaining": "9",
        "x-ratelimit-requests-limit": "100",
        "x-ratelimit-requests-remaining": "87",
        "x-ttl": "14400",
        "x-envoy-upstream-service-time": "11",
        "cache-control": "no-store, no-cache, must-revalidate",
        "pragma": "no-cache",
        "expires": "0",
        "strict-transport-security": "max-age=31536000; includeSubDomains",
        "cf-cache-status": "DYNAMIC",
        "nel": "{\"report_to\":\"cf-nel\",\"success_fraction\":0.0,\"max_age\":604800}",
        "report-to": "{\"group\":\"cf-nel\",\"max_age\":604800,\"endpoints\":[{\"url\":\"https://a.nel.cloudflare.com/report/v4?s=baWW2Vu1j11aG9UwGw5XrNiqXQ9wXVqazLTu8qeXBlvg7pPobQSrP5Qt%2BSaZPJRtvTWgGguzkB4gn01YrUFZs%2BCIeKJM8Y9NSfPuoAFHO3Sqf4%2BvL7QiTA%3D%3D\"}]}",
        "cf-ray": "9a30241839a9c0fd-ARN"
      }
    }
  },
  {
    "request": {
      "method": "GET",
      "url": "https://v3.football.api-sports.io/fixtures",
      "headers": {
        "x-rapidapi-key": "52dd...5e7f",
        "x-rapidapi-host": "api-football-v1.p.rapidapi.com"
      },
      "queryParams": {
        "season": "2022",
        "team": "40"
      }
    },
    "response": {
      "status": 200,
      "data": {
        "get": "fixtures",
        "parameters": {
          "season": "2022",
          "team": "40"
        },
        "errors": [],
        "results": 59,
        "paging": {
          "current": 1,
          "total": 1
        },
        "response": [
          {
            "fixture": {
              "id": 862929,
              "referee": "C. Pawson",
              "timezone": "UTC",
              "date": "2022-07-30T16:00:00+00:00",
              "timestamp": 1659196800,
              "periods": {
                "first": 1659196800,
                "second": 1659200400
              },
              "venue": {
                "id": 547,
                "name": "King Power Stadium",
                "city": "Leicester, Leicestershire"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 528,
              "name": "Community Shield",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/528.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Final",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              },
              "away": {
                "id": 50,
                "name": "Manchester City",
                "logo": "https://media.api-sports.io/football/teams/50.png",
                "winner": false
              }
            },
            "goals": {
              "home": 3,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 0
              },
              "fulltime": {
                "home": 3,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 867947,
              "referee": "A. Madley",
              "timezone": "UTC",
              "date": "2022-08-06T11:30:00+00:00",
              "timestamp": 1659785400,
              "periods": {
                "first": 1659785400,
                "second": 1659789000
              },
              "venue": {
                "id": 535,
                "name": "Craven Cottage",
                "city": "London"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 1",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 36,
                "name": "Fulham",
                "logo": "https://media.api-sports.io/football/teams/36.png",
                "winner": undefined
              },
              "away": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": undefined
              }
            },
            "goals": {
              "home": 2,
              "away": 2
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 0
              },
              "fulltime": {
                "home": 2,
                "away": 2
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 867961,
              "referee": "P. Tierney",
              "timezone": "UTC",
              "date": "2022-08-15T19:00:00+00:00",
              "timestamp": 1660590000,
              "periods": {
                "first": 1660590000,
                "second": 1660593600
              },
              "venue": {
                "id": 550,
                "name": "Anfield",
                "city": "Liverpool"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 2",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": undefined
              },
              "away": {
                "id": 52,
                "name": "Crystal Palace",
                "logo": "https://media.api-sports.io/football/teams/52.png",
                "winner": undefined
              }
            },
            "goals": {
              "home": 1,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 1
              },
              "fulltime": {
                "home": 1,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 867972,
              "referee": "M. Oliver",
              "timezone": "UTC",
              "date": "2022-08-22T19:00:00+00:00",
              "timestamp": 1661194800,
              "periods": {
                "first": 1661194800,
                "second": 1661198400
              },
              "venue": {
                "id": 556,
                "name": "Old Trafford",
                "city": "Manchester"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 3",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 33,
                "name": "Manchester United",
                "logo": "https://media.api-sports.io/football/teams/33.png",
                "winner": true
              },
              "away": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": false
              }
            },
            "goals": {
              "home": 2,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 0
              },
              "fulltime": {
                "home": 2,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 867981,
              "referee": "S. Attwell",
              "timezone": "UTC",
              "date": "2022-08-27T14:00:00+00:00",
              "timestamp": 1661608800,
              "periods": {
                "first": 1661608800,
                "second": 1661612400
              },
              "venue": {
                "id": 550,
                "name": "Anfield",
                "city": "Liverpool"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 4",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              },
              "away": {
                "id": 35,
                "name": "Bournemouth",
                "logo": "https://media.api-sports.io/football/teams/35.png",
                "winner": false
              }
            },
            "goals": {
              "home": 9,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 5,
                "away": 0
              },
              "fulltime": {
                "home": 9,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 867994,
              "referee": "A. Marriner",
              "timezone": "UTC",
              "date": "2022-08-31T19:00:00+00:00",
              "timestamp": 1661972400,
              "periods": {
                "first": 1661972400,
                "second": 1661976000
              },
              "venue": {
                "id": 550,
                "name": "Anfield",
                "city": "Liverpool"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 5",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              },
              "away": {
                "id": 34,
                "name": "Newcastle",
                "logo": "https://media.api-sports.io/football/teams/34.png",
                "winner": false
              }
            },
            "goals": {
              "home": 2,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 1
              },
              "fulltime": {
                "home": 2,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 868000,
              "referee": "A. Taylor",
              "timezone": "UTC",
              "date": "2022-09-03T11:30:00+00:00",
              "timestamp": 1662204600,
              "periods": {
                "first": 1662204600,
                "second": 1662208200
              },
              "venue": {
                "id": 8560,
                "name": "Goodison Park",
                "city": "Liverpool"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 6",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 45,
                "name": "Everton",
                "logo": "https://media.api-sports.io/football/teams/45.png",
                "winner": undefined
              },
              "away": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": undefined
              }
            },
            "goals": {
              "home": 0,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 0,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 868012,
              "referee": "P. Tierney",
              "timezone": "UTC",
              "date": "2023-03-01T20:00:00+00:00",
              "timestamp": 1677700800,
              "periods": {
                "first": 1677700800,
                "second": 1677704400
              },
              "venue": {
                "id": 550,
                "name": "Anfield",
                "city": "Liverpool"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 7",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              },
              "away": {
                "id": 39,
                "name": "Wolves",
                "logo": "https://media.api-sports.io/football/teams/39.png",
                "winner": false
              }
            },
            "goals": {
              "home": 2,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 2,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 868019,
              "referee": "A. Taylor",
              "timezone": "UTC",
              "date": "2023-04-04T19:00:00+00:00",
              "timestamp": 1680634800,
              "periods": {
                "first": 1680634800,
                "second": 1680638400
              },
              "venue": {
                "id": 519,
                "name": "Stamford Bridge",
                "city": "London"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 8",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": undefined
              },
              "away": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": undefined
              }
            },
            "goals": {
              "home": 0,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 0,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 868032,
              "referee": "A. Madley",
              "timezone": "UTC",
              "date": "2022-10-01T14:00:00+00:00",
              "timestamp": 1664632800,
              "periods": {
                "first": 1664632800,
                "second": 1664636400
              },
              "venue": {
                "id": 550,
                "name": "Anfield",
                "city": "Liverpool"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 9",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": undefined
              },
              "away": {
                "id": 51,
                "name": "Brighton",
                "logo": "https://media.api-sports.io/football/teams/51.png",
                "winner": undefined
              }
            },
            "goals": {
              "home": 3,
              "away": 3
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 2
              },
              "fulltime": {
                "home": 3,
                "away": 3
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 868037,
              "referee": "M. Oliver",
              "timezone": "UTC",
              "date": "2022-10-09T15:30:00+00:00",
              "timestamp": 1665329400,
              "periods": {
                "first": 1665329400,
                "second": 1665333000
              },
              "venue": {
                "id": 494,
                "name": "Emirates Stadium",
                "city": "London"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 10",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 42,
                "name": "Arsenal",
                "logo": "https://media.api-sports.io/football/teams/42.png",
                "winner": true
              },
              "away": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": false
              }
            },
            "goals": {
              "home": 3,
              "away": 2
            },
            "score": {
              "halftime": {
                "home": 2,
                "away": 1
              },
              "fulltime": {
                "home": 3,
                "away": 2
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 868051,
              "referee": "A. Taylor",
              "timezone": "UTC",
              "date": "2022-10-16T15:30:00+00:00",
              "timestamp": 1665934200,
              "periods": {
                "first": 1665934200,
                "second": 1665937800
              },
              "venue": {
                "id": 550,
                "name": "Anfield",
                "city": "Liverpool"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 11",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              },
              "away": {
                "id": 50,
                "name": "Manchester City",
                "logo": "https://media.api-sports.io/football/teams/50.png",
                "winner": false
              }
            },
            "goals": {
              "home": 1,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 1,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 868064,
              "referee": "S. Attwell",
              "timezone": "UTC",
              "date": "2022-10-19T18:30:00+00:00",
              "timestamp": 1666204200,
              "periods": {
                "first": 1666204200,
                "second": 1666207800
              },
              "venue": {
                "id": 550,
                "name": "Anfield",
                "city": "Liverpool"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 12",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              },
              "away": {
                "id": 48,
                "name": "West Ham",
                "logo": "https://media.api-sports.io/football/teams/48.png",
                "winner": false
              }
            },
            "goals": {
              "home": 1,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 0
              },
              "fulltime": {
                "home": 1,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 868071,
              "referee": "P. Tierney",
              "timezone": "UTC",
              "date": "2022-10-22T11:30:00+00:00",
              "timestamp": 1666438200,
              "periods": {
                "first": 1666438200,
                "second": 1666441800
              },
              "venue": {
                "id": 566,
                "name": "The City Ground",
                "city": "Nottingham, Nottinghamshire"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 13",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 65,
                "name": "Nottingham Forest",
                "logo": "https://media.api-sports.io/football/teams/65.png",
                "winner": true
              },
              "away": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": false
              }
            },
            "goals": {
              "home": 1,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 1,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 868083,
              "referee": "M. Oliver",
              "timezone": "UTC",
              "date": "2022-10-29T18:45:00+00:00",
              "timestamp": 1667069100,
              "periods": {
                "first": 1667069100,
                "second": 1667072700
              },
              "venue": {
                "id": 550,
                "name": "Anfield",
                "city": "Liverpool"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 14",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": false
              },
              "away": {
                "id": 63,
                "name": "Leeds",
                "logo": "https://media.api-sports.io/football/teams/63.png",
                "winner": true
              }
            },
            "goals": {
              "home": 1,
              "away": 2
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 1
              },
              "fulltime": {
                "home": 1,
                "away": 2
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 868093,
              "referee": "A. Madley",
              "timezone": "UTC",
              "date": "2022-11-06T16:30:00+00:00",
              "timestamp": 1667752200,
              "periods": {
                "first": 1667752200,
                "second": 1667755800
              },
              "venue": {
                "id": 593,
                "name": "Tottenham Hotspur Stadium",
                "city": "London"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 15",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 47,
                "name": "Tottenham",
                "logo": "https://media.api-sports.io/football/teams/47.png",
                "winner": false
              },
              "away": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              }
            },
            "goals": {
              "home": 1,
              "away": 2
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 2
              },
              "fulltime": {
                "home": 1,
                "away": 2
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 868099,
              "referee": "S. Hooper",
              "timezone": "UTC",
              "date": "2022-11-12T15:00:00+00:00",
              "timestamp": 1668265200,
              "periods": {
                "first": 1668265200,
                "second": 1668268800
              },
              "venue": {
                "id": 550,
                "name": "Anfield",
                "city": "Liverpool"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 16",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              },
              "away": {
                "id": 41,
                "name": "Southampton",
                "logo": "https://media.api-sports.io/football/teams/41.png",
                "winner": false
              }
            },
            "goals": {
              "home": 3,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 3,
                "away": 1
              },
              "fulltime": {
                "home": 3,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 868107,
              "referee": "P. Tierney",
              "timezone": "UTC",
              "date": "2022-12-26T17:30:00+00:00",
              "timestamp": 1672075800,
              "periods": {
                "first": 1672075800,
                "second": 1672079400
              },
              "venue": {
                "id": 495,
                "name": "Villa Park",
                "city": "Birmingham"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 17",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 66,
                "name": "Aston Villa",
                "logo": "https://media.api-sports.io/football/teams/66.png",
                "winner": false
              },
              "away": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              }
            },
            "goals": {
              "home": 1,
              "away": 3
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 2
              },
              "fulltime": {
                "home": 1,
                "away": 3
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 868119,
              "referee": "C. Pawson",
              "timezone": "UTC",
              "date": "2022-12-30T20:00:00+00:00",
              "timestamp": 1672430400,
              "periods": {
                "first": 1672430400,
                "second": 1672434000
              },
              "venue": {
                "id": 550,
                "name": "Anfield",
                "city": "Liverpool"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 18",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              },
              "away": {
                "id": 46,
                "name": "Leicester",
                "logo": "https://media.api-sports.io/football/teams/46.png",
                "winner": false
              }
            },
            "goals": {
              "home": 2,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 2,
                "away": 1
              },
              "fulltime": {
                "home": 2,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 868128,
              "referee": "S. Attwell",
              "timezone": "UTC",
              "date": "2023-01-02T17:30:00+00:00",
              "timestamp": 1672680600,
              "periods": {
                "first": 1672680600,
                "second": 1672684200
              },
              "venue": {
                "id": 10503,
                "name": "Gtech Community Stadium",
                "city": "Brentford, Middlesex"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 19",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 55,
                "name": "Brentford",
                "logo": "https://media.api-sports.io/football/teams/55.png",
                "winner": true
              },
              "away": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": false
              }
            },
            "goals": {
              "home": 3,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 2,
                "away": 0
              },
              "fulltime": {
                "home": 3,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 868138,
              "referee": "D. England",
              "timezone": "UTC",
              "date": "2023-01-14T15:00:00+00:00",
              "timestamp": 1673708400,
              "periods": {
                "first": 1673708400,
                "second": 1673712000
              },
              "venue": {
                "id": 508,
                "name": "The American Express Community Stadium",
                "city": "Falmer, East Sussex"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 20",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 51,
                "name": "Brighton",
                "logo": "https://media.api-sports.io/football/teams/51.png",
                "winner": true
              },
              "away": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": false
              }
            },
            "goals": {
              "home": 3,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 3,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 868152,
              "referee": "M. Oliver",
              "timezone": "UTC",
              "date": "2023-01-21T12:30:00+00:00",
              "timestamp": 1674304200,
              "periods": {
                "first": 1674304200,
                "second": 1674307800
              },
              "venue": {
                "id": 550,
                "name": "Anfield",
                "city": "Liverpool"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 21",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": undefined
              },
              "away": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": undefined
              }
            },
            "goals": {
              "home": 0,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 0,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 868165,
              "referee": "P. Tierney",
              "timezone": "UTC",
              "date": "2023-02-04T15:00:00+00:00",
              "timestamp": 1675522800,
              "periods": {
                "first": 1675522800,
                "second": 1675526400
              },
              "venue": {
                "id": 600,
                "name": "Molineux Stadium",
                "city": "Wolverhampton, West Midlands"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 22",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 39,
                "name": "Wolves",
                "logo": "https://media.api-sports.io/football/teams/39.png",
                "winner": true
              },
              "away": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": false
              }
            },
            "goals": {
              "home": 3,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 2,
                "away": 0
              },
              "fulltime": {
                "home": 3,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 868172,
              "referee": "S. Hooper",
              "timezone": "UTC",
              "date": "2023-02-13T20:00:00+00:00",
              "timestamp": 1676318400,
              "periods": {
                "first": 1676318400,
                "second": 1676322000
              },
              "venue": {
                "id": 550,
                "name": "Anfield",
                "city": "Liverpool"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 23",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              },
              "away": {
                "id": 45,
                "name": "Everton",
                "logo": "https://media.api-sports.io/football/teams/45.png",
                "winner": false
              }
            },
            "goals": {
              "home": 2,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 0
              },
              "fulltime": {
                "home": 2,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 868182,
              "referee": "A. Taylor",
              "timezone": "UTC",
              "date": "2023-02-18T17:30:00+00:00",
              "timestamp": 1676741400,
              "periods": {
                "first": 1676741400,
                "second": 1676745000
              },
              "venue": {
                "id": 562,
                "name": "St. James' Park",
                "city": "Newcastle upon Tyne"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 24",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 34,
                "name": "Newcastle",
                "logo": "https://media.api-sports.io/football/teams/34.png",
                "winner": false
              },
              "away": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              }
            },
            "goals": {
              "home": 0,
              "away": 2
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 2
              },
              "fulltime": {
                "home": 0,
                "away": 2
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 868187,
              "referee": "D. England",
              "timezone": "UTC",
              "date": "2023-02-25T19:45:00+00:00",
              "timestamp": 1677354300,
              "periods": {
                "first": 1677354300,
                "second": 1677357900
              },
              "venue": {
                "id": 525,
                "name": "Selhurst Park",
                "city": "London"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 25",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 52,
                "name": "Crystal Palace",
                "logo": "https://media.api-sports.io/football/teams/52.png",
                "winner": undefined
              },
              "away": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": undefined
              }
            },
            "goals": {
              "home": 0,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 0,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 868201,
              "referee": "A. Madley",
              "timezone": "UTC",
              "date": "2023-03-05T16:30:00+00:00",
              "timestamp": 1678033800,
              "periods": {
                "first": 1678033800,
                "second": 1678037400
              },
              "venue": {
                "id": 550,
                "name": "Anfield",
                "city": "Liverpool"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 26",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              },
              "away": {
                "id": 33,
                "name": "Manchester United",
                "logo": "https://media.api-sports.io/football/teams/33.png",
                "winner": false
              }
            },
            "goals": {
              "home": 7,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 0
              },
              "fulltime": {
                "home": 7,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 868206,
              "referee": "J. Brooks",
              "timezone": "UTC",
              "date": "2023-03-11T12:30:00+00:00",
              "timestamp": 1678537800,
              "periods": {
                "first": 1678537800,
                "second": 1678541400
              },
              "venue": {
                "id": 504,
                "name": "Vitality Stadium",
                "city": "Bournemouth, Dorset"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 27",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 35,
                "name": "Bournemouth",
                "logo": "https://media.api-sports.io/football/teams/35.png",
                "winner": true
              },
              "away": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": false
              }
            },
            "goals": {
              "home": 1,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 0
              },
              "fulltime": {
                "home": 1,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 868221,
              "referee": "S. Attwell",
              "timezone": "UTC",
              "date": "2023-05-03T19:00:00+00:00",
              "timestamp": 1683140400,
              "periods": {
                "first": 1683140400,
                "second": 1683144000
              },
              "venue": {
                "id": 550,
                "name": "Anfield",
                "city": "Liverpool"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 28",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              },
              "away": {
                "id": 36,
                "name": "Fulham",
                "logo": "https://media.api-sports.io/football/teams/36.png",
                "winner": false
              }
            },
            "goals": {
              "home": 1,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 0
              },
              "fulltime": {
                "home": 1,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 868232,
              "referee": "S. Hooper",
              "timezone": "UTC",
              "date": "2023-04-01T11:30:00+00:00",
              "timestamp": 1680348600,
              "periods": {
                "first": 1680348600,
                "second": 1680352200
              },
              "venue": {
                "id": 555,
                "name": "Etihad Stadium",
                "city": "Manchester"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 29",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 50,
                "name": "Manchester City",
                "logo": "https://media.api-sports.io/football/teams/50.png",
                "winner": true
              },
              "away": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": false
              }
            },
            "goals": {
              "home": 4,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 1
              },
              "fulltime": {
                "home": 4,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 868241,
              "referee": "P. Tierney",
              "timezone": "UTC",
              "date": "2023-04-09T15:30:00+00:00",
              "timestamp": 1681054200,
              "periods": {
                "first": 1681054200,
                "second": 1681057800
              },
              "venue": {
                "id": 550,
                "name": "Anfield",
                "city": "Liverpool"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 30",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": undefined
              },
              "away": {
                "id": 42,
                "name": "Arsenal",
                "logo": "https://media.api-sports.io/football/teams/42.png",
                "winner": undefined
              }
            },
            "goals": {
              "home": 2,
              "away": 2
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 2
              },
              "fulltime": {
                "home": 2,
                "away": 2
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 868249,
              "referee": "C. Pawson",
              "timezone": "UTC",
              "date": "2023-04-17T19:00:00+00:00",
              "timestamp": 1681758000,
              "periods": {
                "first": 1681758000,
                "second": 1681761600
              },
              "venue": {
                "id": 546,
                "name": "Elland Road",
                "city": "Leeds, West Yorkshire"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 31",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 63,
                "name": "Leeds",
                "logo": "https://media.api-sports.io/football/teams/63.png",
                "winner": false
              },
              "away": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              }
            },
            "goals": {
              "home": 1,
              "away": 6
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 2
              },
              "fulltime": {
                "home": 1,
                "away": 6
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 868263,
              "referee": "M. Oliver",
              "timezone": "UTC",
              "date": "2023-04-22T14:00:00+00:00",
              "timestamp": 1682172000,
              "periods": {
                "first": 1682172000,
                "second": 1682175600
              },
              "venue": {
                "id": 550,
                "name": "Anfield",
                "city": "Liverpool"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 32",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              },
              "away": {
                "id": 65,
                "name": "Nottingham Forest",
                "logo": "https://media.api-sports.io/football/teams/65.png",
                "winner": false
              }
            },
            "goals": {
              "home": 3,
              "away": 2
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 3,
                "away": 2
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 868270,
              "referee": "C. Kavanagh",
              "timezone": "UTC",
              "date": "2023-04-26T18:45:00+00:00",
              "timestamp": 1682534700,
              "periods": {
                "first": 1682534700,
                "second": 1682538300
              },
              "venue": {
                "id": 598,
                "name": "London Stadium",
                "city": "London"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 33",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 48,
                "name": "West Ham",
                "logo": "https://media.api-sports.io/football/teams/48.png",
                "winner": false
              },
              "away": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              }
            },
            "goals": {
              "home": 1,
              "away": 2
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 1
              },
              "fulltime": {
                "home": 1,
                "away": 2
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 868283,
              "referee": "P. Tierney",
              "timezone": "UTC",
              "date": "2023-04-30T15:30:00+00:00",
              "timestamp": 1682868600,
              "periods": {
                "first": 1682868600,
                "second": 1682872200
              },
              "venue": {
                "id": 550,
                "name": "Anfield",
                "city": "Liverpool"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 34",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              },
              "away": {
                "id": 47,
                "name": "Tottenham",
                "logo": "https://media.api-sports.io/football/teams/47.png",
                "winner": false
              }
            },
            "goals": {
              "home": 4,
              "away": 3
            },
            "score": {
              "halftime": {
                "home": 3,
                "away": 1
              },
              "fulltime": {
                "home": 4,
                "away": 3
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 868289,
              "referee": "A. Taylor",
              "timezone": "UTC",
              "date": "2023-05-06T16:30:00+00:00",
              "timestamp": 1683390600,
              "periods": {
                "first": 1683390600,
                "second": 1683394200
              },
              "venue": {
                "id": 550,
                "name": "Anfield",
                "city": "Liverpool"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 35",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              },
              "away": {
                "id": 55,
                "name": "Brentford",
                "logo": "https://media.api-sports.io/football/teams/55.png",
                "winner": false
              }
            },
            "goals": {
              "home": 1,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 0
              },
              "fulltime": {
                "home": 1,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 868303,
              "referee": "C. Pawson",
              "timezone": "UTC",
              "date": "2023-05-15T19:00:00+00:00",
              "timestamp": 1684177200,
              "periods": {
                "first": 1684177200,
                "second": 1684180800
              },
              "venue": {
                "id": 547,
                "name": "King Power Stadium",
                "city": "Leicester, Leicestershire"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 36",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 46,
                "name": "Leicester",
                "logo": "https://media.api-sports.io/football/teams/46.png",
                "winner": false
              },
              "away": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              }
            },
            "goals": {
              "home": 0,
              "away": 3
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 2
              },
              "fulltime": {
                "home": 0,
                "away": 3
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 868309,
              "referee": "J. Brooks",
              "timezone": "UTC",
              "date": "2023-05-20T14:00:00+00:00",
              "timestamp": 1684591200,
              "periods": {
                "first": 1684591200,
                "second": 1684594800
              },
              "venue": {
                "id": 550,
                "name": "Anfield",
                "city": "Liverpool"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 37",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": undefined
              },
              "away": {
                "id": 66,
                "name": "Aston Villa",
                "logo": "https://media.api-sports.io/football/teams/66.png",
                "winner": undefined
              }
            },
            "goals": {
              "home": 1,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 1
              },
              "fulltime": {
                "home": 1,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 868325,
              "referee": "D. England",
              "timezone": "UTC",
              "date": "2023-05-28T15:30:00+00:00",
              "timestamp": 1685287800,
              "periods": {
                "first": 1685287800,
                "second": 1685291400
              },
              "venue": {
                "id": 585,
                "name": "St. Mary's Stadium",
                "city": "Southampton, Hampshire"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 38",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 41,
                "name": "Southampton",
                "logo": "https://media.api-sports.io/football/teams/41.png",
                "winner": undefined
              },
              "away": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": undefined
              }
            },
            "goals": {
              "home": 4,
              "away": 4
            },
            "score": {
              "halftime": {
                "home": 2,
                "away": 2
              },
              "fulltime": {
                "home": 4,
                "away": 4
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 869514,
              "referee": "A. Marriner",
              "timezone": "UTC",
              "date": "2022-07-12T13:00:00+00:00",
              "timestamp": 1657630800,
              "periods": {
                "first": 1657630800,
                "second": 1657634400
              },
              "venue": {
                "id": 1551,
                "name": "Rajamangala National Stadium",
                "city": "Bangkok"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 667,
              "name": "Friendlies Clubs",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/667.png",
              "flag": undefined,
              "season": 2022,
              "round": "Club Friendlies 1",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 33,
                "name": "Manchester United",
                "logo": "https://media.api-sports.io/football/teams/33.png",
                "winner": true
              },
              "away": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": false
              }
            },
            "goals": {
              "home": 4,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 3,
                "away": 0
              },
              "fulltime": {
                "home": 4,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 869517,
              "referee": "M. Jahari",
              "timezone": "UTC",
              "date": "2022-07-15T12:35:00+00:00",
              "timestamp": 1657888500,
              "periods": {
                "first": 1657888500,
                "second": 1657892100
              },
              "venue": {
                "id": 3897,
                "name": "The National Stadium",
                "city": "Singapore"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 667,
              "name": "Friendlies Clubs",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/667.png",
              "flag": undefined,
              "season": 2022,
              "round": "Club Friendlies 1",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              },
              "away": {
                "id": 52,
                "name": "Crystal Palace",
                "logo": "https://media.api-sports.io/football/teams/52.png",
                "winner": false
              }
            },
            "goals": {
              "home": 2,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 0
              },
              "fulltime": {
                "home": 2,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 869532,
              "referee": undefined,
              "timezone": "UTC",
              "date": "2022-07-21T17:15:00+00:00",
              "timestamp": 1658423700,
              "periods": {
                "first": 1658423700,
                "second": 1658427300
              },
              "venue": {
                "id": 738,
                "name": "Red Bull Arena",
                "city": "Leipzig"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 667,
              "name": "Friendlies Clubs",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/667.png",
              "flag": undefined,
              "season": 2022,
              "round": "Club Friendlies 1",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 173,
                "name": "RB Leipzig",
                "logo": "https://media.api-sports.io/football/teams/173.png",
                "winner": false
              },
              "away": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              }
            },
            "goals": {
              "home": 0,
              "away": 5
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 1
              },
              "fulltime": {
                "home": 0,
                "away": 5
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 869549,
              "referee": "D. England",
              "timezone": "UTC",
              "date": "2022-07-31T18:30:00+00:00",
              "timestamp": 1659292200,
              "periods": {
                "first": 1659292200,
                "second": 1659295800
              },
              "venue": {
                "id": 550,
                "name": "Anfield",
                "city": "Liverpool"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 667,
              "name": "Friendlies Clubs",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/667.png",
              "flag": undefined,
              "season": 2022,
              "round": "Club Friendlies 1",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": false
              },
              "away": {
                "id": 95,
                "name": "Strasbourg",
                "logo": "https://media.api-sports.io/football/teams/95.png",
                "winner": true
              }
            },
            "goals": {
              "home": 0,
              "away": 3
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 3
              },
              "fulltime": {
                "home": 0,
                "away": 3
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 889909,
              "referee": "S. Ebner",
              "timezone": "UTC",
              "date": "2022-07-27T18:00:00+00:00",
              "timestamp": 1658944800,
              "periods": {
                "first": 1658944800,
                "second": 1658948400
              },
              "venue": {
                "id": 148,
                "name": "Red Bull Arena",
                "city": "Wals-Siezenheim"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 667,
              "name": "Friendlies Clubs",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/667.png",
              "flag": undefined,
              "season": 2022,
              "round": "Club Friendlies 1",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 571,
                "name": "Red Bull Salzburg",
                "logo": "https://media.api-sports.io/football/teams/571.png",
                "winner": true
              },
              "away": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": false
              }
            },
            "goals": {
              "home": 1,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 0
              },
              "fulltime": {
                "home": 1,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 945936,
              "referee": "T. Harrington",
              "timezone": "UTC",
              "date": "2022-11-09T20:00:00+00:00",
              "timestamp": 1668024000,
              "periods": {
                "first": 1668024000,
                "second": 1668027600
              },
              "venue": {
                "id": 550,
                "name": "Anfield",
                "city": "Liverpool"
              },
              "status": {
                "long": "Match Finished",
                "short": "PEN",
                "elapsed": 120,
                "extra": undefined
              }
            },
            "league": {
              "id": 48,
              "name": "League Cup",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/48.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "3rd Round",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              },
              "away": {
                "id": 69,
                "name": "Derby",
                "logo": "https://media.api-sports.io/football/teams/69.png",
                "winner": false
              }
            },
            "goals": {
              "home": 0,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 0,
                "away": 0
              },
              "extratime": {
                "home": 0,
                "away": 0
              },
              "penalty": {
                "home": 3,
                "away": 2
              }
            }
          },
          {
            "fixture": {
              "id": 946859,
              "referee": "Carlos del Cerro",
              "timezone": "UTC",
              "date": "2022-09-07T19:00:00+00:00",
              "timestamp": 1662577200,
              "periods": {
                "first": 1662577200,
                "second": 1662580800
              },
              "venue": {
                "id": 11904,
                "name": "Stadio Diego Armando Maradona",
                "city": "Napoli"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 2,
              "name": "UEFA Champions League",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/2.png",
              "flag": undefined,
              "season": 2022,
              "round": "Group A - 1",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 492,
                "name": "Napoli",
                "logo": "https://media.api-sports.io/football/teams/492.png",
                "winner": true
              },
              "away": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": false
              }
            },
            "goals": {
              "home": 4,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 3,
                "away": 0
              },
              "fulltime": {
                "home": 4,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 946867,
              "referee": "Artur Soares Dias",
              "timezone": "UTC",
              "date": "2022-09-13T19:00:00+00:00",
              "timestamp": 1663095600,
              "periods": {
                "first": 1663095600,
                "second": 1663099200
              },
              "venue": {
                "id": 550,
                "name": "Anfield",
                "city": "Liverpool"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 2,
              "name": "UEFA Champions League",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/2.png",
              "flag": undefined,
              "season": 2022,
              "round": "Group A - 2",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              },
              "away": {
                "id": 194,
                "name": "Ajax",
                "logo": "https://media.api-sports.io/football/teams/194.png",
                "winner": false
              }
            },
            "goals": {
              "home": 2,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 1
              },
              "fulltime": {
                "home": 2,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 946883,
              "referee": "C. Turpin",
              "timezone": "UTC",
              "date": "2022-10-04T19:00:00+00:00",
              "timestamp": 1664910000,
              "periods": {
                "first": 1664910000,
                "second": 1664913600
              },
              "venue": {
                "id": 550,
                "name": "Anfield",
                "city": "Liverpool"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 2,
              "name": "UEFA Champions League",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/2.png",
              "flag": undefined,
              "season": 2022,
              "round": "Group A - 3",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              },
              "away": {
                "id": 257,
                "name": "Rangers",
                "logo": "https://media.api-sports.io/football/teams/257.png",
                "winner": false
              }
            },
            "goals": {
              "home": 2,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 0
              },
              "fulltime": {
                "home": 2,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 946907,
              "referee": "S. Vinčić",
              "timezone": "UTC",
              "date": "2022-10-12T19:00:00+00:00",
              "timestamp": 1665601200,
              "periods": {
                "first": 1665601200,
                "second": 1665604800
              },
              "venue": {
                "id": 1401,
                "name": "Ibrox Stadium",
                "city": "Glasgow"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 2,
              "name": "UEFA Champions League",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/2.png",
              "flag": undefined,
              "season": 2022,
              "round": "Group A - 4",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 257,
                "name": "Rangers",
                "logo": "https://media.api-sports.io/football/teams/257.png",
                "winner": false
              },
              "away": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              }
            },
            "goals": {
              "home": 1,
              "away": 7
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 1
              },
              "fulltime": {
                "home": 1,
                "away": 7
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 946924,
              "referee": "José Sánchez",
              "timezone": "UTC",
              "date": "2022-10-26T19:00:00+00:00",
              "timestamp": 1666810800,
              "periods": {
                "first": 1666810800,
                "second": 1666814400
              },
              "venue": {
                "id": 1117,
                "name": "Johan Cruijff Arena",
                "city": "Amsterdam"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 2,
              "name": "UEFA Champions League",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/2.png",
              "flag": undefined,
              "season": 2022,
              "round": "Group A - 5",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 194,
                "name": "Ajax",
                "logo": "https://media.api-sports.io/football/teams/194.png",
                "winner": false
              },
              "away": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              }
            },
            "goals": {
              "home": 0,
              "away": 3
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 1
              },
              "fulltime": {
                "home": 0,
                "away": 3
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 946931,
              "referee": "T. Stieler",
              "timezone": "UTC",
              "date": "2022-11-01T20:00:00+00:00",
              "timestamp": 1667332800,
              "periods": {
                "first": 1667332800,
                "second": 1667336400
              },
              "venue": {
                "id": 550,
                "name": "Anfield",
                "city": "Liverpool"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 2,
              "name": "UEFA Champions League",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/2.png",
              "flag": undefined,
              "season": 2022,
              "round": "Group A - 6",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              },
              "away": {
                "id": 492,
                "name": "Napoli",
                "logo": "https://media.api-sports.io/football/teams/492.png",
                "winner": false
              }
            },
            "goals": {
              "home": 2,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 2,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 971801,
              "referee": "I. Kovacs",
              "timezone": "UTC",
              "date": "2023-02-21T20:00:00+00:00",
              "timestamp": 1677009600,
              "periods": {
                "first": 1677009600,
                "second": 1677013200
              },
              "venue": {
                "id": 550,
                "name": "Anfield",
                "city": "Liverpool"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 2,
              "name": "UEFA Champions League",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/2.png",
              "flag": undefined,
              "season": 2022,
              "round": "Round of 16",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": false
              },
              "away": {
                "id": 541,
                "name": "Real Madrid",
                "logo": "https://media.api-sports.io/football/teams/541.png",
                "winner": true
              }
            },
            "goals": {
              "home": 2,
              "away": 5
            },
            "score": {
              "halftime": {
                "home": 2,
                "away": 2
              },
              "fulltime": {
                "home": 2,
                "away": 5
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 971802,
              "referee": "F. Zwayer",
              "timezone": "UTC",
              "date": "2023-03-15T20:00:00+00:00",
              "timestamp": 1678910400,
              "periods": {
                "first": 1678910400,
                "second": 1678914000
              },
              "venue": {
                "id": 1456,
                "name": "Estadio Santiago Bernabéu",
                "city": "Madrid"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 2,
              "name": "UEFA Champions League",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/2.png",
              "flag": undefined,
              "season": 2022,
              "round": "Round of 16",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 541,
                "name": "Real Madrid",
                "logo": "https://media.api-sports.io/football/teams/541.png",
                "winner": true
              },
              "away": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": false
              }
            },
            "goals": {
              "home": 1,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 1,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 972362,
              "referee": "D. Coote",
              "timezone": "UTC",
              "date": "2022-12-22T20:00:00+00:00",
              "timestamp": 1671739200,
              "periods": {
                "first": 1671739200,
                "second": 1671742800
              },
              "venue": {
                "id": 555,
                "name": "Etihad Stadium",
                "city": "Manchester"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 48,
              "name": "League Cup",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/48.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Round of 16",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 50,
                "name": "Manchester City",
                "logo": "https://media.api-sports.io/football/teams/50.png",
                "winner": true
              },
              "away": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": false
              }
            },
            "goals": {
              "home": 3,
              "away": 2
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 1
              },
              "fulltime": {
                "home": 3,
                "away": 2
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 976477,
              "referee": "A. Madley",
              "timezone": "UTC",
              "date": "2023-01-07T20:00:00+00:00",
              "timestamp": 1673121600,
              "periods": {
                "first": 1673121600,
                "second": 1673125200
              },
              "venue": {
                "id": 550,
                "name": "Anfield",
                "city": "Liverpool"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 45,
              "name": "FA Cup",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/45.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "3rd Round",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": undefined
              },
              "away": {
                "id": 39,
                "name": "Wolves",
                "logo": "https://media.api-sports.io/football/teams/39.png",
                "winner": undefined
              }
            },
            "goals": {
              "home": 2,
              "away": 2
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 1
              },
              "fulltime": {
                "home": 2,
                "away": 2
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 976995,
              "referee": "Ahmed Eisa Mohamed",
              "timezone": "UTC",
              "date": "2022-12-11T14:00:00+00:00",
              "timestamp": 1670767200,
              "periods": {
                "first": 1670767200,
                "second": 1670770800
              },
              "venue": {
                "id": undefined,
                "name": "Al Maktoum Stadium",
                "city": "Dubai"
              },
              "status": {
                "long": "Match Finished",
                "short": "PEN",
                "elapsed": 120,
                "extra": undefined
              }
            },
            "league": {
              "id": 667,
              "name": "Friendlies Clubs",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/667.png",
              "flag": undefined,
              "season": 2022,
              "round": "Club Friendlies 1",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": false
              },
              "away": {
                "id": 80,
                "name": "Lyon",
                "logo": "https://media.api-sports.io/football/teams/80.png",
                "winner": true
              }
            },
            "goals": {
              "home": 1,
              "away": 3
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 1
              },
              "fulltime": {
                "home": 1,
                "away": 3
              },
              "extratime": {
                "home": 0,
                "away": 0
              },
              "penalty": {
                "home": 3,
                "away": 5
              }
            }
          },
          {
            "fixture": {
              "id": 977003,
              "referee": "Omar Mohamed Al Ali",
              "timezone": "UTC",
              "date": "2022-12-16T15:30:00+00:00",
              "timestamp": 1671204600,
              "periods": {
                "first": 1671204600,
                "second": 1671208200
              },
              "venue": {
                "id": undefined,
                "name": "Al Maktoum Stadium",
                "city": "Dubai"
              },
              "status": {
                "long": "Match Finished",
                "short": "PEN",
                "elapsed": 120,
                "extra": undefined
              }
            },
            "league": {
              "id": 667,
              "name": "Friendlies Clubs",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/667.png",
              "flag": undefined,
              "season": 2022,
              "round": "Club Friendlies 1",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": false
              },
              "away": {
                "id": 489,
                "name": "AC Milan",
                "logo": "https://media.api-sports.io/football/teams/489.png",
                "winner": true
              }
            },
            "goals": {
              "home": 4,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 2,
                "away": 1
              },
              "fulltime": {
                "home": 4,
                "away": 1
              },
              "extratime": {
                "home": 0,
                "away": 0
              },
              "penalty": {
                "home": 3,
                "away": 4
              }
            }
          },
          {
            "fixture": {
              "id": 986119,
              "referee": "A. Marriner",
              "timezone": "UTC",
              "date": "2023-01-17T19:45:00+00:00",
              "timestamp": 1673984700,
              "periods": {
                "first": 1673984700,
                "second": 1673988300
              },
              "venue": {
                "id": 600,
                "name": "Molineux Stadium",
                "city": "Wolverhampton, West Midlands"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 45,
              "name": "FA Cup",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/45.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "3rd Round Replays",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 39,
                "name": "Wolves",
                "logo": "https://media.api-sports.io/football/teams/39.png",
                "winner": false
              },
              "away": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": true
              }
            },
            "goals": {
              "home": 0,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 1
              },
              "fulltime": {
                "home": 0,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 990835,
              "referee": "D. Coote",
              "timezone": "UTC",
              "date": "2023-01-29T13:30:00+00:00",
              "timestamp": 1674999000,
              "periods": {
                "first": 1674999000,
                "second": 1675002600
              },
              "venue": {
                "id": 508,
                "name": "The American Express Community Stadium",
                "city": "Falmer, East Sussex"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 45,
              "name": "FA Cup",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/45.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "4th Round",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 51,
                "name": "Brighton",
                "logo": "https://media.api-sports.io/football/teams/51.png",
                "winner": true
              },
              "away": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": false
              }
            },
            "goals": {
              "home": 2,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 1
              },
              "fulltime": {
                "home": 2,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          }
        ]
      },
      "headers": {
        "date": "Sun, 23 Nov 2025 10:56:41 GMT",
        "content-type": "application/json",
        "transfer-encoding": "chunked",
        "connection": "keep-alive",
        "server": "cloudflare",
        "vary": "Accept-Encoding",
        "access-control-allow-origin": "*",
        "access-control-allow-credentials": "True",
        "access-control-allow-methods": "GET, OPTIONS",
        "access-control-allow-headers": "x-rapidapi-key, x-apisports-key, x-rapidapi-host",
        "x-ratelimit-limit": "10",
        "x-ratelimit-remaining": "8",
        "x-ratelimit-requests-limit": "100",
        "x-ratelimit-requests-remaining": "86",
        "x-ttl": "14400",
        "x-envoy-upstream-service-time": "10",
        "cache-control": "no-store, no-cache, must-revalidate",
        "pragma": "no-cache",
        "expires": "0",
        "strict-transport-security": "max-age=31536000; includeSubDomains",
        "cf-cache-status": "DYNAMIC",
        "nel": "{\"report_to\":\"cf-nel\",\"success_fraction\":0.0,\"max_age\":604800}",
        "report-to": "{\"group\":\"cf-nel\",\"max_age\":604800,\"endpoints\":[{\"url\":\"https://a.nel.cloudflare.com/report/v4?s=z8WUfWVdo4ZbnmnjkWKJl0Y8QI5GHGtXg9HtaMH5SvQP5cPTSz8hmvbqM194R7nQtrHarNFQKCrHhQhmmOzXYMuOqY7Sxkee6PRQmtvkrgQmqhCJMIYSQQ%3D%3D\"}]}",
        "cf-ray": "9a3024317f73c0fd-ARN"
      }
    }
  },
  {
    "request": {
      "method": "GET",
      "url": "https://api.weatherapi.com/v1/forecast.json",
      "headers": {},
      "queryParams": {
        "key": "6058...1603",
        "q": "London",
        "days": "3"
      }
    },
    "response": {
      "status": 200,
      "data": {
        "location": {
          "name": "London",
          "region": "City of London, Greater London",
          "country": "United Kingdom",
          "lat": 51.5171,
          "lon": -0.1062,
          "tz_id": "Europe/London",
          "localtime_epoch": 1763896166,
          "localtime": "2025-11-23 11:09"
        },
        "current": {
          "last_updated_epoch": 1763895600,
          "last_updated": "2025-11-23 11:00",
          "temp_c": 10.4,
          "temp_f": 50.7,
          "is_day": 1,
          "condition": {
            "text": "Cloudy",
            "icon": "//cdn.weatherapi.com/weather/64x64/day/119.png",
            "code": 1006
          },
          "wind_mph": 14.3,
          "wind_kph": 23,
          "wind_degree": 272,
          "wind_dir": "W",
          "pressure_mb": 998,
          "pressure_in": 29.47,
          "precip_mm": 0,
          "precip_in": 0,
          "humidity": 82,
          "cloud": 25,
          "feelslike_c": 7.6,
          "feelslike_f": 45.7,
          "windchill_c": 5.9,
          "windchill_f": 42.6,
          "heatindex_c": 9.1,
          "heatindex_f": 48.3,
          "dewpoint_c": 4.9,
          "dewpoint_f": 40.8,
          "vis_km": 10,
          "vis_miles": 6,
          "uv": 0.7,
          "gust_mph": 20.2,
          "gust_kph": 32.5
        },
        "forecast": {
          "forecastday": [
            {
              "date": "2025-11-23",
              "date_epoch": 1763856000,
              "day": {
                "maxtemp_c": 9.4,
                "maxtemp_f": 48.9,
                "mintemp_c": 4.9,
                "mintemp_f": 40.8,
                "avgtemp_c": 7.1,
                "avgtemp_f": 44.9,
                "maxwind_mph": 15.9,
                "maxwind_kph": 25.6,
                "totalprecip_mm": 3.97,
                "totalprecip_in": 0.16,
                "totalsnow_cm": 0,
                "avgvis_km": 8.4,
                "avgvis_miles": 5,
                "avghumidity": 83,
                "daily_will_it_rain": 1,
                "daily_chance_of_rain": 98,
                "daily_will_it_snow": 0,
                "daily_chance_of_snow": 0,
                "condition": {
                  "text": "Patchy rain nearby",
                  "icon": "//cdn.weatherapi.com/weather/64x64/day/176.png",
                  "code": 1063
                },
                "uv": 0.1
              },
              "astro": {
                "sunrise": "07:32 AM",
                "sunset": "04:01 PM",
                "moonrise": "11:06 AM",
                "moonset": "05:45 PM",
                "moon_phase": "Waxing Crescent",
                "moon_illumination": 7,
                "is_moon_up": 0,
                "is_sun_up": 0
              },
              "hour": [
                {
                  "time_epoch": 1763856000,
                  "time": "2025-11-23 00:00",
                  "temp_c": 6.6,
                  "temp_f": 43.9,
                  "is_day": 0,
                  "condition": {
                    "text": "Mist",
                    "icon": "//cdn.weatherapi.com/weather/64x64/night/143.png",
                    "code": 1030
                  },
                  "wind_mph": 1.1,
                  "wind_kph": 1.8,
                  "wind_degree": 198,
                  "wind_dir": "SSW",
                  "pressure_mb": 1007,
                  "pressure_in": 29.74,
                  "precip_mm": 0.01,
                  "precip_in": 0,
                  "snow_cm": 0,
                  "humidity": 96,
                  "cloud": 87,
                  "feelslike_c": 6.6,
                  "feelslike_f": 43.9,
                  "windchill_c": 6.6,
                  "windchill_f": 43.9,
                  "heatindex_c": 6.6,
                  "heatindex_f": 43.9,
                  "dewpoint_c": 6,
                  "dewpoint_f": 42.7,
                  "will_it_rain": 1,
                  "chance_of_rain": 84,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 2,
                  "vis_miles": 1,
                  "gust_mph": 1.8,
                  "gust_kph": 2.8,
                  "uv": 0
                },
                {
                  "time_epoch": 1763859600,
                  "time": "2025-11-23 01:00",
                  "temp_c": 6.5,
                  "temp_f": 43.7,
                  "is_day": 0,
                  "condition": {
                    "text": "Mist",
                    "icon": "//cdn.weatherapi.com/weather/64x64/night/143.png",
                    "code": 1030
                  },
                  "wind_mph": 3.8,
                  "wind_kph": 6.1,
                  "wind_degree": 298,
                  "wind_dir": "WNW",
                  "pressure_mb": 1007,
                  "pressure_in": 29.73,
                  "precip_mm": 0,
                  "precip_in": 0,
                  "snow_cm": 0,
                  "humidity": 96,
                  "cloud": 77,
                  "feelslike_c": 5.4,
                  "feelslike_f": 41.7,
                  "windchill_c": 5.4,
                  "windchill_f": 41.7,
                  "heatindex_c": 6.5,
                  "heatindex_f": 43.7,
                  "dewpoint_c": 5.9,
                  "dewpoint_f": 42.7,
                  "will_it_rain": 0,
                  "chance_of_rain": 0,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 2,
                  "vis_miles": 1,
                  "gust_mph": 6,
                  "gust_kph": 9.6,
                  "uv": 0
                },
                {
                  "time_epoch": 1763863200,
                  "time": "2025-11-23 02:00",
                  "temp_c": 5.7,
                  "temp_f": 42.3,
                  "is_day": 0,
                  "condition": {
                    "text": "Fog",
                    "icon": "//cdn.weatherapi.com/weather/64x64/night/248.png",
                    "code": 1135
                  },
                  "wind_mph": 4.9,
                  "wind_kph": 7.9,
                  "wind_degree": 270,
                  "wind_dir": "W",
                  "pressure_mb": 1007,
                  "pressure_in": 29.73,
                  "precip_mm": 0,
                  "precip_in": 0,
                  "snow_cm": 0,
                  "humidity": 98,
                  "cloud": 100,
                  "feelslike_c": 4,
                  "feelslike_f": 39.2,
                  "windchill_c": 4,
                  "windchill_f": 39.2,
                  "heatindex_c": 5.7,
                  "heatindex_f": 42.3,
                  "dewpoint_c": 5.4,
                  "dewpoint_f": 41.7,
                  "will_it_rain": 0,
                  "chance_of_rain": 0,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 0,
                  "vis_miles": 0,
                  "gust_mph": 8.2,
                  "gust_kph": 13.1,
                  "uv": 0
                },
                {
                  "time_epoch": 1763866800,
                  "time": "2025-11-23 03:00",
                  "temp_c": 5.3,
                  "temp_f": 41.6,
                  "is_day": 0,
                  "condition": {
                    "text": "Mist",
                    "icon": "//cdn.weatherapi.com/weather/64x64/night/143.png",
                    "code": 1030
                  },
                  "wind_mph": 5.1,
                  "wind_kph": 8.3,
                  "wind_degree": 247,
                  "wind_dir": "WSW",
                  "pressure_mb": 1006,
                  "pressure_in": 29.71,
                  "precip_mm": 0,
                  "precip_in": 0,
                  "snow_cm": 0,
                  "humidity": 97,
                  "cloud": 57,
                  "feelslike_c": 3.5,
                  "feelslike_f": 38.2,
                  "windchill_c": 3.5,
                  "windchill_f": 38.2,
                  "heatindex_c": 5.3,
                  "heatindex_f": 41.6,
                  "dewpoint_c": 4.9,
                  "dewpoint_f": 40.7,
                  "will_it_rain": 0,
                  "chance_of_rain": 0,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 2,
                  "vis_miles": 1,
                  "gust_mph": 8.6,
                  "gust_kph": 13.9,
                  "uv": 0
                },
                {
                  "time_epoch": 1763870400,
                  "time": "2025-11-23 04:00",
                  "temp_c": 5,
                  "temp_f": 41,
                  "is_day": 0,
                  "condition": {
                    "text": "Partly Cloudy ",
                    "icon": "//cdn.weatherapi.com/weather/64x64/night/116.png",
                    "code": 1003
                  },
                  "wind_mph": 5.1,
                  "wind_kph": 8.3,
                  "wind_degree": 223,
                  "wind_dir": "SW",
                  "pressure_mb": 1005,
                  "pressure_in": 29.69,
                  "precip_mm": 0,
                  "precip_in": 0,
                  "snow_cm": 0,
                  "humidity": 94,
                  "cloud": 25,
                  "feelslike_c": 3.1,
                  "feelslike_f": 37.5,
                  "windchill_c": 3.1,
                  "windchill_f": 37.5,
                  "heatindex_c": 5,
                  "heatindex_f": 41,
                  "dewpoint_c": 4.1,
                  "dewpoint_f": 39.4,
                  "will_it_rain": 0,
                  "chance_of_rain": 0,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 10,
                  "vis_miles": 6,
                  "gust_mph": 8.9,
                  "gust_kph": 14.3,
                  "uv": 0
                },
                {
                  "time_epoch": 1763874000,
                  "time": "2025-11-23 05:00",
                  "temp_c": 4.9,
                  "temp_f": 40.8,
                  "is_day": 0,
                  "condition": {
                    "text": "Partly Cloudy ",
                    "icon": "//cdn.weatherapi.com/weather/64x64/night/116.png",
                    "code": 1003
                  },
                  "wind_mph": 6.5,
                  "wind_kph": 10.4,
                  "wind_degree": 207,
                  "wind_dir": "SSW",
                  "pressure_mb": 1004,
                  "pressure_in": 29.66,
                  "precip_mm": 0,
                  "precip_in": 0,
                  "snow_cm": 0,
                  "humidity": 90,
                  "cloud": 51,
                  "feelslike_c": 2.4,
                  "feelslike_f": 36.4,
                  "windchill_c": 2.4,
                  "windchill_f": 36.4,
                  "heatindex_c": 4.9,
                  "heatindex_f": 40.8,
                  "dewpoint_c": 3.4,
                  "dewpoint_f": 38.2,
                  "will_it_rain": 0,
                  "chance_of_rain": 0,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 10,
                  "vis_miles": 6,
                  "gust_mph": 11.3,
                  "gust_kph": 18.2,
                  "uv": 0
                },
                {
                  "time_epoch": 1763877600,
                  "time": "2025-11-23 06:00",
                  "temp_c": 5,
                  "temp_f": 40.9,
                  "is_day": 0,
                  "condition": {
                    "text": "Patchy rain nearby",
                    "icon": "//cdn.weatherapi.com/weather/64x64/night/176.png",
                    "code": 1063
                  },
                  "wind_mph": 6.5,
                  "wind_kph": 10.4,
                  "wind_degree": 172,
                  "wind_dir": "S",
                  "pressure_mb": 1002,
                  "pressure_in": 29.6,
                  "precip_mm": 0.01,
                  "precip_in": 0,
                  "snow_cm": 0,
                  "humidity": 90,
                  "cloud": 60,
                  "feelslike_c": 2.5,
                  "feelslike_f": 36.5,
                  "windchill_c": 2.5,
                  "windchill_f": 36.5,
                  "heatindex_c": 5,
                  "heatindex_f": 40.9,
                  "dewpoint_c": 3.5,
                  "dewpoint_f": 38.3,
                  "will_it_rain": 1,
                  "chance_of_rain": 73,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 10,
                  "vis_miles": 6,
                  "gust_mph": 12,
                  "gust_kph": 19.3,
                  "uv": 0
                },
                {
                  "time_epoch": 1763881200,
                  "time": "2025-11-23 07:00",
                  "temp_c": 6.5,
                  "temp_f": 43.7,
                  "is_day": 0,
                  "condition": {
                    "text": "Light rain",
                    "icon": "//cdn.weatherapi.com/weather/64x64/night/296.png",
                    "code": 1183
                  },
                  "wind_mph": 9.2,
                  "wind_kph": 14.8,
                  "wind_degree": 183,
                  "wind_dir": "S",
                  "pressure_mb": 1001,
                  "pressure_in": 29.55,
                  "precip_mm": 0.94,
                  "precip_in": 0.04,
                  "snow_cm": 0,
                  "humidity": 89,
                  "cloud": 100,
                  "feelslike_c": 3.7,
                  "feelslike_f": 38.6,
                  "windchill_c": 3.7,
                  "windchill_f": 38.6,
                  "heatindex_c": 6.5,
                  "heatindex_f": 43.8,
                  "dewpoint_c": 4.8,
                  "dewpoint_f": 40.6,
                  "will_it_rain": 1,
                  "chance_of_rain": 100,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 9,
                  "vis_miles": 5,
                  "gust_mph": 15.6,
                  "gust_kph": 25.1,
                  "uv": 0
                },
                {
                  "time_epoch": 1763884800,
                  "time": "2025-11-23 08:00",
                  "temp_c": 7.8,
                  "temp_f": 46,
                  "is_day": 1,
                  "condition": {
                    "text": "Moderate rain",
                    "icon": "//cdn.weatherapi.com/weather/64x64/day/302.png",
                    "code": 1189
                  },
                  "wind_mph": 13,
                  "wind_kph": 20.9,
                  "wind_degree": 184,
                  "wind_dir": "S",
                  "pressure_mb": 999,
                  "pressure_in": 29.5,
                  "precip_mm": 2.72,
                  "precip_in": 0.11,
                  "snow_cm": 0,
                  "humidity": 93,
                  "cloud": 100,
                  "feelslike_c": 4.5,
                  "feelslike_f": 40.1,
                  "windchill_c": 4.5,
                  "windchill_f": 40.1,
                  "heatindex_c": 7.8,
                  "heatindex_f": 46,
                  "dewpoint_c": 6.7,
                  "dewpoint_f": 44,
                  "will_it_rain": 1,
                  "chance_of_rain": 100,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 7,
                  "vis_miles": 4,
                  "gust_mph": 21,
                  "gust_kph": 33.7,
                  "uv": 0
                },
                {
                  "time_epoch": 1763888400,
                  "time": "2025-11-23 09:00",
                  "temp_c": 9.2,
                  "temp_f": 48.5,
                  "is_day": 1,
                  "condition": {
                    "text": "Light rain shower",
                    "icon": "//cdn.weatherapi.com/weather/64x64/day/353.png",
                    "code": 1240
                  },
                  "wind_mph": 12.8,
                  "wind_kph": 20.5,
                  "wind_degree": 220,
                  "wind_dir": "SW",
                  "pressure_mb": 998,
                  "pressure_in": 29.48,
                  "precip_mm": 0.21,
                  "precip_in": 0.01,
                  "snow_cm": 0,
                  "humidity": 93,
                  "cloud": 89,
                  "feelslike_c": 6.3,
                  "feelslike_f": 43.3,
                  "windchill_c": 6.3,
                  "windchill_f": 43.3,
                  "heatindex_c": 9.2,
                  "heatindex_f": 48.5,
                  "dewpoint_c": 8.2,
                  "dewpoint_f": 46.7,
                  "will_it_rain": 1,
                  "chance_of_rain": 100,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 10,
                  "vis_miles": 6,
                  "gust_mph": 21,
                  "gust_kph": 33.8,
                  "uv": 0
                },
                {
                  "time_epoch": 1763892000,
                  "time": "2025-11-23 10:00",
                  "temp_c": 9.4,
                  "temp_f": 48.9,
                  "is_day": 1,
                  "condition": {
                    "text": "Patchy rain nearby",
                    "icon": "//cdn.weatherapi.com/weather/64x64/day/176.png",
                    "code": 1063
                  },
                  "wind_mph": 14.8,
                  "wind_kph": 23.8,
                  "wind_degree": 263,
                  "wind_dir": "W",
                  "pressure_mb": 998,
                  "pressure_in": 29.47,
                  "precip_mm": 0.05,
                  "precip_in": 0,
                  "snow_cm": 0,
                  "humidity": 83,
                  "cloud": 78,
                  "feelslike_c": 6.2,
                  "feelslike_f": 43.2,
                  "windchill_c": 6.2,
                  "windchill_f": 43.2,
                  "heatindex_c": 9.4,
                  "heatindex_f": 48.8,
                  "dewpoint_c": 6.7,
                  "dewpoint_f": 44.1,
                  "will_it_rain": 1,
                  "chance_of_rain": 86,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 10,
                  "vis_miles": 6,
                  "gust_mph": 22.1,
                  "gust_kph": 35.5,
                  "uv": 0.5
                },
                {
                  "time_epoch": 1763895600,
                  "time": "2025-11-23 11:00",
                  "temp_c": 10.4,
                  "temp_f": 50.7,
                  "is_day": 1,
                  "condition": {
                    "text": "Cloudy ",
                    "icon": "//cdn.weatherapi.com/weather/64x64/day/119.png",
                    "code": 1006
                  },
                  "wind_mph": 14.3,
                  "wind_kph": 23,
                  "wind_degree": 272,
                  "wind_dir": "W",
                  "pressure_mb": 998,
                  "pressure_in": 29.47,
                  "precip_mm": 0,
                  "precip_in": 0,
                  "snow_cm": 0,
                  "humidity": 82,
                  "cloud": 25,
                  "feelslike_c": 5.9,
                  "feelslike_f": 42.6,
                  "windchill_c": 5.9,
                  "windchill_f": 42.6,
                  "heatindex_c": 9.1,
                  "heatindex_f": 48.3,
                  "dewpoint_c": 4.9,
                  "dewpoint_f": 40.8,
                  "will_it_rain": 0,
                  "chance_of_rain": 0,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 10,
                  "vis_miles": 6,
                  "gust_mph": 20.2,
                  "gust_kph": 32.5,
                  "uv": 0.7
                },
                {
                  "time_epoch": 1763899200,
                  "time": "2025-11-23 12:00",
                  "temp_c": 8.8,
                  "temp_f": 47.9,
                  "is_day": 1,
                  "condition": {
                    "text": "Sunny",
                    "icon": "//cdn.weatherapi.com/weather/64x64/day/113.png",
                    "code": 1000
                  },
                  "wind_mph": 12.8,
                  "wind_kph": 20.5,
                  "wind_degree": 265,
                  "wind_dir": "W",
                  "pressure_mb": 998,
                  "pressure_in": 29.46,
                  "precip_mm": 0,
                  "precip_in": 0,
                  "snow_cm": 0,
                  "humidity": 73,
                  "cloud": 17,
                  "feelslike_c": 5.9,
                  "feelslike_f": 42.6,
                  "windchill_c": 5.9,
                  "windchill_f": 42.6,
                  "heatindex_c": 8.8,
                  "heatindex_f": 47.9,
                  "dewpoint_c": 4.3,
                  "dewpoint_f": 39.7,
                  "will_it_rain": 0,
                  "chance_of_rain": 0,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 10,
                  "vis_miles": 6,
                  "gust_mph": 17.4,
                  "gust_kph": 28,
                  "uv": 0.8
                },
                {
                  "time_epoch": 1763902800,
                  "time": "2025-11-23 13:00",
                  "temp_c": 8.7,
                  "temp_f": 47.6,
                  "is_day": 1,
                  "condition": {
                    "text": "Sunny",
                    "icon": "//cdn.weatherapi.com/weather/64x64/day/113.png",
                    "code": 1000
                  },
                  "wind_mph": 13.2,
                  "wind_kph": 21.2,
                  "wind_degree": 262,
                  "wind_dir": "W",
                  "pressure_mb": 998,
                  "pressure_in": 29.46,
                  "precip_mm": 0,
                  "precip_in": 0,
                  "snow_cm": 0,
                  "humidity": 73,
                  "cloud": 25,
                  "feelslike_c": 5.6,
                  "feelslike_f": 42.1,
                  "windchill_c": 5.6,
                  "windchill_f": 42.1,
                  "heatindex_c": 8.7,
                  "heatindex_f": 47.6,
                  "dewpoint_c": 4.1,
                  "dewpoint_f": 39.3,
                  "will_it_rain": 0,
                  "chance_of_rain": 0,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 10,
                  "vis_miles": 6,
                  "gust_mph": 17.8,
                  "gust_kph": 28.6,
                  "uv": 0.7
                },
                {
                  "time_epoch": 1763906400,
                  "time": "2025-11-23 14:00",
                  "temp_c": 8.6,
                  "temp_f": 47.5,
                  "is_day": 1,
                  "condition": {
                    "text": "Partly Cloudy ",
                    "icon": "//cdn.weatherapi.com/weather/64x64/day/116.png",
                    "code": 1003
                  },
                  "wind_mph": 13,
                  "wind_kph": 20.9,
                  "wind_degree": 258,
                  "wind_dir": "WSW",
                  "pressure_mb": 997,
                  "pressure_in": 29.45,
                  "precip_mm": 0,
                  "precip_in": 0,
                  "snow_cm": 0,
                  "humidity": 71,
                  "cloud": 39,
                  "feelslike_c": 5.5,
                  "feelslike_f": 41.9,
                  "windchill_c": 5.5,
                  "windchill_f": 41.9,
                  "heatindex_c": 8.6,
                  "heatindex_f": 47.5,
                  "dewpoint_c": 3.7,
                  "dewpoint_f": 38.6,
                  "will_it_rain": 0,
                  "chance_of_rain": 0,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 10,
                  "vis_miles": 6,
                  "gust_mph": 18.1,
                  "gust_kph": 29.1,
                  "uv": 0.5
                },
                {
                  "time_epoch": 1763910000,
                  "time": "2025-11-23 15:00",
                  "temp_c": 8.2,
                  "temp_f": 46.7,
                  "is_day": 1,
                  "condition": {
                    "text": "Cloudy ",
                    "icon": "//cdn.weatherapi.com/weather/64x64/day/119.png",
                    "code": 1006
                  },
                  "wind_mph": 13.2,
                  "wind_kph": 21.2,
                  "wind_degree": 254,
                  "wind_dir": "WSW",
                  "pressure_mb": 997,
                  "pressure_in": 29.45,
                  "precip_mm": 0,
                  "precip_in": 0,
                  "snow_cm": 0,
                  "humidity": 72,
                  "cloud": 74,
                  "feelslike_c": 5,
                  "feelslike_f": 40.9,
                  "windchill_c": 5,
                  "windchill_f": 40.9,
                  "heatindex_c": 8.2,
                  "heatindex_f": 46.7,
                  "dewpoint_c": 3.4,
                  "dewpoint_f": 38.2,
                  "will_it_rain": 0,
                  "chance_of_rain": 0,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 10,
                  "vis_miles": 6,
                  "gust_mph": 19.4,
                  "gust_kph": 31.3,
                  "uv": 0.2
                },
                {
                  "time_epoch": 1763913600,
                  "time": "2025-11-23 16:00",
                  "temp_c": 7.6,
                  "temp_f": 45.7,
                  "is_day": 1,
                  "condition": {
                    "text": "Partly Cloudy ",
                    "icon": "//cdn.weatherapi.com/weather/64x64/day/116.png",
                    "code": 1003
                  },
                  "wind_mph": 12.8,
                  "wind_kph": 20.5,
                  "wind_degree": 251,
                  "wind_dir": "WSW",
                  "pressure_mb": 997,
                  "pressure_in": 29.44,
                  "precip_mm": 0,
                  "precip_in": 0,
                  "snow_cm": 0,
                  "humidity": 74,
                  "cloud": 47,
                  "feelslike_c": 4.3,
                  "feelslike_f": 39.8,
                  "windchill_c": 4.3,
                  "windchill_f": 39.8,
                  "heatindex_c": 7.6,
                  "heatindex_f": 45.7,
                  "dewpoint_c": 3.3,
                  "dewpoint_f": 37.9,
                  "will_it_rain": 0,
                  "chance_of_rain": 0,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 10,
                  "vis_miles": 6,
                  "gust_mph": 19.8,
                  "gust_kph": 31.9,
                  "uv": 0
                },
                {
                  "time_epoch": 1763917200,
                  "time": "2025-11-23 17:00",
                  "temp_c": 7.3,
                  "temp_f": 45.1,
                  "is_day": 0,
                  "condition": {
                    "text": "Partly Cloudy ",
                    "icon": "//cdn.weatherapi.com/weather/64x64/night/116.png",
                    "code": 1003
                  },
                  "wind_mph": 12.1,
                  "wind_kph": 19.4,
                  "wind_degree": 244,
                  "wind_dir": "WSW",
                  "pressure_mb": 997,
                  "pressure_in": 29.44,
                  "precip_mm": 0,
                  "precip_in": 0,
                  "snow_cm": 0,
                  "humidity": 76,
                  "cloud": 50,
                  "feelslike_c": 4,
                  "feelslike_f": 39.2,
                  "windchill_c": 4,
                  "windchill_f": 39.2,
                  "heatindex_c": 7.3,
                  "heatindex_f": 45.1,
                  "dewpoint_c": 3.3,
                  "dewpoint_f": 37.9,
                  "will_it_rain": 0,
                  "chance_of_rain": 0,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 10,
                  "vis_miles": 6,
                  "gust_mph": 19,
                  "gust_kph": 30.6,
                  "uv": 0
                },
                {
                  "time_epoch": 1763920800,
                  "time": "2025-11-23 18:00",
                  "temp_c": 7,
                  "temp_f": 44.7,
                  "is_day": 0,
                  "condition": {
                    "text": "Partly Cloudy ",
                    "icon": "//cdn.weatherapi.com/weather/64x64/night/116.png",
                    "code": 1003
                  },
                  "wind_mph": 13.2,
                  "wind_kph": 21.2,
                  "wind_degree": 241,
                  "wind_dir": "WSW",
                  "pressure_mb": 997,
                  "pressure_in": 29.43,
                  "precip_mm": 0,
                  "precip_in": 0,
                  "snow_cm": 0,
                  "humidity": 76,
                  "cloud": 32,
                  "feelslike_c": 3.5,
                  "feelslike_f": 38.3,
                  "windchill_c": 3.5,
                  "windchill_f": 38.3,
                  "heatindex_c": 7,
                  "heatindex_f": 44.7,
                  "dewpoint_c": 3.2,
                  "dewpoint_f": 37.7,
                  "will_it_rain": 0,
                  "chance_of_rain": 0,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 10,
                  "vis_miles": 6,
                  "gust_mph": 20.6,
                  "gust_kph": 33.2,
                  "uv": 0
                },
                {
                  "time_epoch": 1763924400,
                  "time": "2025-11-23 19:00",
                  "temp_c": 6.8,
                  "temp_f": 44.3,
                  "is_day": 0,
                  "condition": {
                    "text": "Partly Cloudy ",
                    "icon": "//cdn.weatherapi.com/weather/64x64/night/116.png",
                    "code": 1003
                  },
                  "wind_mph": 13.9,
                  "wind_kph": 22.3,
                  "wind_degree": 236,
                  "wind_dir": "WSW",
                  "pressure_mb": 996,
                  "pressure_in": 29.41,
                  "precip_mm": 0,
                  "precip_in": 0,
                  "snow_cm": 0,
                  "humidity": 77,
                  "cloud": 48,
                  "feelslike_c": 3.1,
                  "feelslike_f": 37.6,
                  "windchill_c": 3.1,
                  "windchill_f": 37.6,
                  "heatindex_c": 6.8,
                  "heatindex_f": 44.3,
                  "dewpoint_c": 3,
                  "dewpoint_f": 37.4,
                  "will_it_rain": 0,
                  "chance_of_rain": 0,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 10,
                  "vis_miles": 6,
                  "gust_mph": 21.7,
                  "gust_kph": 34.9,
                  "uv": 0
                },
                {
                  "time_epoch": 1763928000,
                  "time": "2025-11-23 20:00",
                  "temp_c": 6.6,
                  "temp_f": 43.9,
                  "is_day": 0,
                  "condition": {
                    "text": "Cloudy ",
                    "icon": "//cdn.weatherapi.com/weather/64x64/night/119.png",
                    "code": 1006
                  },
                  "wind_mph": 14.5,
                  "wind_kph": 23.4,
                  "wind_degree": 236,
                  "wind_dir": "WSW",
                  "pressure_mb": 996,
                  "pressure_in": 29.4,
                  "precip_mm": 0,
                  "precip_in": 0,
                  "snow_cm": 0,
                  "humidity": 76,
                  "cloud": 73,
                  "feelslike_c": 2.8,
                  "feelslike_f": 37,
                  "windchill_c": 2.8,
                  "windchill_f": 37,
                  "heatindex_c": 6.6,
                  "heatindex_f": 43.9,
                  "dewpoint_c": 2.7,
                  "dewpoint_f": 36.9,
                  "will_it_rain": 0,
                  "chance_of_rain": 0,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 10,
                  "vis_miles": 6,
                  "gust_mph": 22.5,
                  "gust_kph": 36.2,
                  "uv": 0
                },
                {
                  "time_epoch": 1763931600,
                  "time": "2025-11-23 21:00",
                  "temp_c": 6.6,
                  "temp_f": 43.8,
                  "is_day": 0,
                  "condition": {
                    "text": "Overcast ",
                    "icon": "//cdn.weatherapi.com/weather/64x64/night/122.png",
                    "code": 1009
                  },
                  "wind_mph": 14.8,
                  "wind_kph": 23.8,
                  "wind_degree": 234,
                  "wind_dir": "SW",
                  "pressure_mb": 995,
                  "pressure_in": 29.38,
                  "precip_mm": 0,
                  "precip_in": 0,
                  "snow_cm": 0,
                  "humidity": 75,
                  "cloud": 99,
                  "feelslike_c": 2.6,
                  "feelslike_f": 36.7,
                  "windchill_c": 2.6,
                  "windchill_f": 36.7,
                  "heatindex_c": 6.6,
                  "heatindex_f": 43.8,
                  "dewpoint_c": 2.5,
                  "dewpoint_f": 36.5,
                  "will_it_rain": 0,
                  "chance_of_rain": 0,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 10,
                  "vis_miles": 6,
                  "gust_mph": 22.7,
                  "gust_kph": 36.6,
                  "uv": 0
                },
                {
                  "time_epoch": 1763935200,
                  "time": "2025-11-23 22:00",
                  "temp_c": 6.9,
                  "temp_f": 44.4,
                  "is_day": 0,
                  "condition": {
                    "text": "Patchy rain nearby",
                    "icon": "//cdn.weatherapi.com/weather/64x64/night/176.png",
                    "code": 1063
                  },
                  "wind_mph": 15.4,
                  "wind_kph": 24.8,
                  "wind_degree": 237,
                  "wind_dir": "WSW",
                  "pressure_mb": 994,
                  "pressure_in": 29.36,
                  "precip_mm": 0.01,
                  "precip_in": 0,
                  "snow_cm": 0,
                  "humidity": 74,
                  "cloud": 100,
                  "feelslike_c": 2.9,
                  "feelslike_f": 37.3,
                  "windchill_c": 2.9,
                  "windchill_f": 37.3,
                  "heatindex_c": 6.9,
                  "heatindex_f": 44.4,
                  "dewpoint_c": 2.6,
                  "dewpoint_f": 36.7,
                  "will_it_rain": 1,
                  "chance_of_rain": 85,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 10,
                  "vis_miles": 6,
                  "gust_mph": 23.3,
                  "gust_kph": 37.5,
                  "uv": 0
                },
                {
                  "time_epoch": 1763938800,
                  "time": "2025-11-23 23:00",
                  "temp_c": 7.4,
                  "temp_f": 45.3,
                  "is_day": 0,
                  "condition": {
                    "text": "Patchy rain nearby",
                    "icon": "//cdn.weatherapi.com/weather/64x64/night/176.png",
                    "code": 1063
                  },
                  "wind_mph": 15.9,
                  "wind_kph": 25.6,
                  "wind_degree": 236,
                  "wind_dir": "WSW",
                  "pressure_mb": 993,
                  "pressure_in": 29.34,
                  "precip_mm": 0.01,
                  "precip_in": 0,
                  "snow_cm": 0,
                  "humidity": 73,
                  "cloud": 100,
                  "feelslike_c": 3.5,
                  "feelslike_f": 38.3,
                  "windchill_c": 3.5,
                  "windchill_f": 38.3,
                  "heatindex_c": 7.4,
                  "heatindex_f": 45.2,
                  "dewpoint_c": 2.9,
                  "dewpoint_f": 37.3,
                  "will_it_rain": 1,
                  "chance_of_rain": 71,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 10,
                  "vis_miles": 6,
                  "gust_mph": 23.9,
                  "gust_kph": 38.5,
                  "uv": 0
                }
              ]
            },
            {
              "date": "2025-11-24",
              "date_epoch": 1763942400,
              "day": {
                "maxtemp_c": 7.3,
                "maxtemp_f": 45.1,
                "mintemp_c": 5.1,
                "mintemp_f": 41.1,
                "avgtemp_c": 6.5,
                "avgtemp_f": 43.8,
                "maxwind_mph": 16.6,
                "maxwind_kph": 26.6,
                "totalprecip_mm": 0.72,
                "totalprecip_in": 0.03,
                "totalsnow_cm": 0,
                "avgvis_km": 10,
                "avgvis_miles": 6,
                "avghumidity": 77,
                "daily_will_it_rain": 1,
                "daily_chance_of_rain": 88,
                "daily_will_it_snow": 0,
                "daily_chance_of_snow": 0,
                "condition": {
                  "text": "Patchy rain nearby",
                  "icon": "//cdn.weatherapi.com/weather/64x64/day/176.png",
                  "code": 1063
                },
                "uv": 0.1
              },
              "astro": {
                "sunrise": "07:34 AM",
                "sunset": "04:00 PM",
                "moonrise": "11:44 AM",
                "moonset": "06:54 PM",
                "moon_phase": "Waxing Crescent",
                "moon_illumination": 12,
                "is_moon_up": 0,
                "is_sun_up": 0
              },
              "hour": [
                {
                  "time_epoch": 1763942400,
                  "time": "2025-11-24 00:00",
                  "temp_c": 7.7,
                  "temp_f": 45.8,
                  "is_day": 0,
                  "condition": {
                    "text": "Patchy rain nearby",
                    "icon": "//cdn.weatherapi.com/weather/64x64/night/176.png",
                    "code": 1063
                  },
                  "wind_mph": 16.6,
                  "wind_kph": 26.6,
                  "wind_degree": 240,
                  "wind_dir": "WSW",
                  "pressure_mb": 993,
                  "pressure_in": 29.32,
                  "precip_mm": 0.04,
                  "precip_in": 0,
                  "snow_cm": 0,
                  "humidity": 73,
                  "cloud": 100,
                  "feelslike_c": 3.8,
                  "feelslike_f": 38.8,
                  "windchill_c": 3.8,
                  "windchill_f": 38.8,
                  "heatindex_c": 7.7,
                  "heatindex_f": 45.8,
                  "dewpoint_c": 3.2,
                  "dewpoint_f": 37.8,
                  "will_it_rain": 0,
                  "chance_of_rain": 60,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 10,
                  "vis_miles": 6,
                  "gust_mph": 24.6,
                  "gust_kph": 39.6,
                  "uv": 0
                },
                {
                  "time_epoch": 1763946000,
                  "time": "2025-11-24 01:00",
                  "temp_c": 7.7,
                  "temp_f": 45.9,
                  "is_day": 0,
                  "condition": {
                    "text": "Patchy rain nearby",
                    "icon": "//cdn.weatherapi.com/weather/64x64/night/176.png",
                    "code": 1063
                  },
                  "wind_mph": 15.9,
                  "wind_kph": 25.6,
                  "wind_degree": 246,
                  "wind_dir": "WSW",
                  "pressure_mb": 992,
                  "pressure_in": 29.3,
                  "precip_mm": 0.12,
                  "precip_in": 0,
                  "snow_cm": 0,
                  "humidity": 74,
                  "cloud": 100,
                  "feelslike_c": 4,
                  "feelslike_f": 39.1,
                  "windchill_c": 4,
                  "windchill_f": 39.1,
                  "heatindex_c": 7.7,
                  "heatindex_f": 45.9,
                  "dewpoint_c": 3.5,
                  "dewpoint_f": 38.2,
                  "will_it_rain": 1,
                  "chance_of_rain": 100,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 10,
                  "vis_miles": 6,
                  "gust_mph": 23.3,
                  "gust_kph": 37.5,
                  "uv": 0
                },
                {
                  "time_epoch": 1763949600,
                  "time": "2025-11-24 02:00",
                  "temp_c": 7.4,
                  "temp_f": 45.3,
                  "is_day": 0,
                  "condition": {
                    "text": "Patchy rain nearby",
                    "icon": "//cdn.weatherapi.com/weather/64x64/night/176.png",
                    "code": 1063
                  },
                  "wind_mph": 15.9,
                  "wind_kph": 25.6,
                  "wind_degree": 245,
                  "wind_dir": "WSW",
                  "pressure_mb": 991,
                  "pressure_in": 29.28,
                  "precip_mm": 0.02,
                  "precip_in": 0,
                  "snow_cm": 0,
                  "humidity": 79,
                  "cloud": 89,
                  "feelslike_c": 3.6,
                  "feelslike_f": 38.4,
                  "windchill_c": 3.6,
                  "windchill_f": 38.4,
                  "heatindex_c": 7.4,
                  "heatindex_f": 45.3,
                  "dewpoint_c": 3.9,
                  "dewpoint_f": 39.1,
                  "will_it_rain": 1,
                  "chance_of_rain": 83,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 10,
                  "vis_miles": 6,
                  "gust_mph": 23.3,
                  "gust_kph": 37.5,
                  "uv": 0
                },
                {
                  "time_epoch": 1763953200,
                  "time": "2025-11-24 03:00",
                  "temp_c": 7.1,
                  "temp_f": 44.7,
                  "is_day": 0,
                  "condition": {
                    "text": "Patchy rain nearby",
                    "icon": "//cdn.weatherapi.com/weather/64x64/night/176.png",
                    "code": 1063
                  },
                  "wind_mph": 16.3,
                  "wind_kph": 26.3,
                  "wind_degree": 252,
                  "wind_dir": "WSW",
                  "pressure_mb": 991,
                  "pressure_in": 29.26,
                  "precip_mm": 0.01,
                  "precip_in": 0,
                  "snow_cm": 0,
                  "humidity": 77,
                  "cloud": 100,
                  "feelslike_c": 3.1,
                  "feelslike_f": 37.5,
                  "windchill_c": 3.1,
                  "windchill_f": 37.5,
                  "heatindex_c": 7.1,
                  "heatindex_f": 44.7,
                  "dewpoint_c": 3.4,
                  "dewpoint_f": 38.1,
                  "will_it_rain": 1,
                  "chance_of_rain": 84,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 10,
                  "vis_miles": 6,
                  "gust_mph": 24.2,
                  "gust_kph": 38.9,
                  "uv": 0
                },
                {
                  "time_epoch": 1763956800,
                  "time": "2025-11-24 04:00",
                  "temp_c": 6.9,
                  "temp_f": 44.3,
                  "is_day": 0,
                  "condition": {
                    "text": "Patchy rain nearby",
                    "icon": "//cdn.weatherapi.com/weather/64x64/night/176.png",
                    "code": 1063
                  },
                  "wind_mph": 14.8,
                  "wind_kph": 23.8,
                  "wind_degree": 258,
                  "wind_dir": "WSW",
                  "pressure_mb": 991,
                  "pressure_in": 29.26,
                  "precip_mm": 0.02,
                  "precip_in": 0,
                  "snow_cm": 0,
                  "humidity": 77,
                  "cloud": 84,
                  "feelslike_c": 3,
                  "feelslike_f": 37.4,
                  "windchill_c": 3,
                  "windchill_f": 37.4,
                  "heatindex_c": 6.9,
                  "heatindex_f": 44.3,
                  "dewpoint_c": 3,
                  "dewpoint_f": 37.5,
                  "will_it_rain": 0,
                  "chance_of_rain": 63,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 10,
                  "vis_miles": 6,
                  "gust_mph": 21.7,
                  "gust_kph": 34.9,
                  "uv": 0
                },
                {
                  "time_epoch": 1763960400,
                  "time": "2025-11-24 05:00",
                  "temp_c": 6.6,
                  "temp_f": 43.9,
                  "is_day": 0,
                  "condition": {
                    "text": "Patchy rain nearby",
                    "icon": "//cdn.weatherapi.com/weather/64x64/night/176.png",
                    "code": 1063
                  },
                  "wind_mph": 13.6,
                  "wind_kph": 22,
                  "wind_degree": 256,
                  "wind_dir": "WSW",
                  "pressure_mb": 990,
                  "pressure_in": 29.25,
                  "precip_mm": 0.02,
                  "precip_in": 0,
                  "snow_cm": 0,
                  "humidity": 78,
                  "cloud": 91,
                  "feelslike_c": 2.9,
                  "feelslike_f": 37.2,
                  "windchill_c": 2.9,
                  "windchill_f": 37.2,
                  "heatindex_c": 6.6,
                  "heatindex_f": 43.9,
                  "dewpoint_c": 3,
                  "dewpoint_f": 37.4,
                  "will_it_rain": 0,
                  "chance_of_rain": 60,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 10,
                  "vis_miles": 6,
                  "gust_mph": 20.1,
                  "gust_kph": 32.4,
                  "uv": 0
                },
                {
                  "time_epoch": 1763964000,
                  "time": "2025-11-24 06:00",
                  "temp_c": 6.7,
                  "temp_f": 44,
                  "is_day": 0,
                  "condition": {
                    "text": "Patchy rain nearby",
                    "icon": "//cdn.weatherapi.com/weather/64x64/night/176.png",
                    "code": 1063
                  },
                  "wind_mph": 14.5,
                  "wind_kph": 23.4,
                  "wind_degree": 267,
                  "wind_dir": "W",
                  "pressure_mb": 990,
                  "pressure_in": 29.24,
                  "precip_mm": 0.01,
                  "precip_in": 0,
                  "snow_cm": 0,
                  "humidity": 77,
                  "cloud": 100,
                  "feelslike_c": 2.8,
                  "feelslike_f": 37.1,
                  "windchill_c": 2.8,
                  "windchill_f": 37.1,
                  "heatindex_c": 6.7,
                  "heatindex_f": 44,
                  "dewpoint_c": 2.9,
                  "dewpoint_f": 37.2,
                  "will_it_rain": 0,
                  "chance_of_rain": 61,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 10,
                  "vis_miles": 6,
                  "gust_mph": 20.7,
                  "gust_kph": 33.3,
                  "uv": 0
                },
                {
                  "time_epoch": 1763967600,
                  "time": "2025-11-24 07:00",
                  "temp_c": 6.3,
                  "temp_f": 43.4,
                  "is_day": 0,
                  "condition": {
                    "text": "Patchy rain nearby",
                    "icon": "//cdn.weatherapi.com/weather/64x64/night/176.png",
                    "code": 1063
                  },
                  "wind_mph": 13.9,
                  "wind_kph": 22.3,
                  "wind_degree": 282,
                  "wind_dir": "WNW",
                  "pressure_mb": 991,
                  "pressure_in": 29.25,
                  "precip_mm": 0.07,
                  "precip_in": 0,
                  "snow_cm": 0,
                  "humidity": 82,
                  "cloud": 100,
                  "feelslike_c": 2.5,
                  "feelslike_f": 36.5,
                  "windchill_c": 2.5,
                  "windchill_f": 36.5,
                  "heatindex_c": 6.3,
                  "heatindex_f": 43.4,
                  "dewpoint_c": 3.6,
                  "dewpoint_f": 38.4,
                  "will_it_rain": 1,
                  "chance_of_rain": 100,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 10,
                  "vis_miles": 6,
                  "gust_mph": 18.6,
                  "gust_kph": 30,
                  "uv": 0
                },
                {
                  "time_epoch": 1763971200,
                  "time": "2025-11-24 08:00",
                  "temp_c": 5.6,
                  "temp_f": 42.1,
                  "is_day": 1,
                  "condition": {
                    "text": "Patchy rain nearby",
                    "icon": "//cdn.weatherapi.com/weather/64x64/day/176.png",
                    "code": 1063
                  },
                  "wind_mph": 12.3,
                  "wind_kph": 19.8,
                  "wind_degree": 292,
                  "wind_dir": "WNW",
                  "pressure_mb": 991,
                  "pressure_in": 29.27,
                  "precip_mm": 0.05,
                  "precip_in": 0,
                  "snow_cm": 0,
                  "humidity": 88,
                  "cloud": 100,
                  "feelslike_c": 1.9,
                  "feelslike_f": 35.3,
                  "windchill_c": 1.9,
                  "windchill_f": 35.3,
                  "heatindex_c": 5.6,
                  "heatindex_f": 42.1,
                  "dewpoint_c": 3.9,
                  "dewpoint_f": 38.9,
                  "will_it_rain": 1,
                  "chance_of_rain": 76,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 10,
                  "vis_miles": 6,
                  "gust_mph": 16.4,
                  "gust_kph": 26.4,
                  "uv": 0
                },
                {
                  "time_epoch": 1763974800,
                  "time": "2025-11-24 09:00",
                  "temp_c": 5.8,
                  "temp_f": 42.4,
                  "is_day": 1,
                  "condition": {
                    "text": "Patchy rain nearby",
                    "icon": "//cdn.weatherapi.com/weather/64x64/day/176.png",
                    "code": 1063
                  },
                  "wind_mph": 11.9,
                  "wind_kph": 19.1,
                  "wind_degree": 311,
                  "wind_dir": "NW",
                  "pressure_mb": 992,
                  "pressure_in": 29.3,
                  "precip_mm": 0.04,
                  "precip_in": 0,
                  "snow_cm": 0,
                  "humidity": 87,
                  "cloud": 100,
                  "feelslike_c": 2.2,
                  "feelslike_f": 35.9,
                  "windchill_c": 2.2,
                  "windchill_f": 35.9,
                  "heatindex_c": 5.8,
                  "heatindex_f": 42.4,
                  "dewpoint_c": 3.7,
                  "dewpoint_f": 38.7,
                  "will_it_rain": 1,
                  "chance_of_rain": 88,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 10,
                  "vis_miles": 6,
                  "gust_mph": 16,
                  "gust_kph": 25.7,
                  "uv": 0.1
                },
                {
                  "time_epoch": 1763978400,
                  "time": "2025-11-24 10:00",
                  "temp_c": 6.2,
                  "temp_f": 43.2,
                  "is_day": 1,
                  "condition": {
                    "text": "Overcast ",
                    "icon": "//cdn.weatherapi.com/weather/64x64/day/122.png",
                    "code": 1009
                  },
                  "wind_mph": 10.5,
                  "wind_kph": 16.9,
                  "wind_degree": 307,
                  "wind_dir": "NW",
                  "pressure_mb": 993,
                  "pressure_in": 29.31,
                  "precip_mm": 0,
                  "precip_in": 0,
                  "snow_cm": 0,
                  "humidity": 79,
                  "cloud": 100,
                  "feelslike_c": 3,
                  "feelslike_f": 37.3,
                  "windchill_c": 3,
                  "windchill_f": 37.3,
                  "heatindex_c": 6.2,
                  "heatindex_f": 43.2,
                  "dewpoint_c": 2.9,
                  "dewpoint_f": 37.3,
                  "will_it_rain": 0,
                  "chance_of_rain": 0,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 10,
                  "vis_miles": 6,
                  "gust_mph": 14.4,
                  "gust_kph": 23.2,
                  "uv": 0.4
                },
                {
                  "time_epoch": 1763982000,
                  "time": "2025-11-24 11:00",
                  "temp_c": 6.5,
                  "temp_f": 43.8,
                  "is_day": 1,
                  "condition": {
                    "text": "Overcast ",
                    "icon": "//cdn.weatherapi.com/weather/64x64/day/122.png",
                    "code": 1009
                  },
                  "wind_mph": 11,
                  "wind_kph": 17.6,
                  "wind_degree": 308,
                  "wind_dir": "NW",
                  "pressure_mb": 993,
                  "pressure_in": 29.33,
                  "precip_mm": 0,
                  "precip_in": 0,
                  "snow_cm": 0,
                  "humidity": 77,
                  "cloud": 96,
                  "feelslike_c": 3.3,
                  "feelslike_f": 37.9,
                  "windchill_c": 3.3,
                  "windchill_f": 37.9,
                  "heatindex_c": 6.5,
                  "heatindex_f": 43.8,
                  "dewpoint_c": 2.8,
                  "dewpoint_f": 37,
                  "will_it_rain": 0,
                  "chance_of_rain": 0,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 10,
                  "vis_miles": 6,
                  "gust_mph": 14,
                  "gust_kph": 22.5,
                  "uv": 0.5
                },
                {
                  "time_epoch": 1763985600,
                  "time": "2025-11-24 12:00",
                  "temp_c": 6,
                  "temp_f": 42.9,
                  "is_day": 1,
                  "condition": {
                    "text": "Overcast ",
                    "icon": "//cdn.weatherapi.com/weather/64x64/day/122.png",
                    "code": 1009
                  },
                  "wind_mph": 10.5,
                  "wind_kph": 16.9,
                  "wind_degree": 305,
                  "wind_dir": "NW",
                  "pressure_mb": 994,
                  "pressure_in": 29.34,
                  "precip_mm": 0,
                  "precip_in": 0,
                  "snow_cm": 0,
                  "humidity": 84,
                  "cloud": 100,
                  "feelslike_c": 2.8,
                  "feelslike_f": 37,
                  "windchill_c": 2.8,
                  "windchill_f": 37,
                  "heatindex_c": 6,
                  "heatindex_f": 42.9,
                  "dewpoint_c": 3.5,
                  "dewpoint_f": 38.3,
                  "will_it_rain": 0,
                  "chance_of_rain": 0,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 10,
                  "vis_miles": 6,
                  "gust_mph": 13.4,
                  "gust_kph": 21.5,
                  "uv": 0.1
                },
                {
                  "time_epoch": 1763989200,
                  "time": "2025-11-24 13:00",
                  "temp_c": 6.9,
                  "temp_f": 44.3,
                  "is_day": 1,
                  "condition": {
                    "text": "Patchy rain nearby",
                    "icon": "//cdn.weatherapi.com/weather/64x64/day/176.png",
                    "code": 1063
                  },
                  "wind_mph": 11,
                  "wind_kph": 17.6,
                  "wind_degree": 310,
                  "wind_dir": "NW",
                  "pressure_mb": 994,
                  "pressure_in": 29.35,
                  "precip_mm": 0.02,
                  "precip_in": 0,
                  "snow_cm": 0,
                  "humidity": 78,
                  "cloud": 100,
                  "feelslike_c": 3.7,
                  "feelslike_f": 38.6,
                  "windchill_c": 3.7,
                  "windchill_f": 38.6,
                  "heatindex_c": 6.9,
                  "heatindex_f": 44.3,
                  "dewpoint_c": 3.3,
                  "dewpoint_f": 38,
                  "will_it_rain": 1,
                  "chance_of_rain": 85,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 10,
                  "vis_miles": 6,
                  "gust_mph": 14.6,
                  "gust_kph": 23.5,
                  "uv": 0.2
                },
                {
                  "time_epoch": 1763992800,
                  "time": "2025-11-24 14:00",
                  "temp_c": 7.3,
                  "temp_f": 45.1,
                  "is_day": 1,
                  "condition": {
                    "text": "Patchy rain nearby",
                    "icon": "//cdn.weatherapi.com/weather/64x64/day/176.png",
                    "code": 1063
                  },
                  "wind_mph": 13.4,
                  "wind_kph": 21.6,
                  "wind_degree": 325,
                  "wind_dir": "NW",
                  "pressure_mb": 994,
                  "pressure_in": 29.37,
                  "precip_mm": 0.05,
                  "precip_in": 0,
                  "snow_cm": 0,
                  "humidity": 74,
                  "cloud": 100,
                  "feelslike_c": 3.8,
                  "feelslike_f": 38.8,
                  "windchill_c": 3.8,
                  "windchill_f": 38.8,
                  "heatindex_c": 7.3,
                  "heatindex_f": 45.1,
                  "dewpoint_c": 2.9,
                  "dewpoint_f": 37.2,
                  "will_it_rain": 1,
                  "chance_of_rain": 100,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 10,
                  "vis_miles": 6,
                  "gust_mph": 18.8,
                  "gust_kph": 30.3,
                  "uv": 0.3
                },
                {
                  "time_epoch": 1763996400,
                  "time": "2025-11-24 15:00",
                  "temp_c": 7.2,
                  "temp_f": 44.9,
                  "is_day": 1,
                  "condition": {
                    "text": "Patchy rain nearby",
                    "icon": "//cdn.weatherapi.com/weather/64x64/day/176.png",
                    "code": 1063
                  },
                  "wind_mph": 14.1,
                  "wind_kph": 22.7,
                  "wind_degree": 321,
                  "wind_dir": "NW",
                  "pressure_mb": 995,
                  "pressure_in": 29.39,
                  "precip_mm": 0.01,
                  "precip_in": 0,
                  "snow_cm": 0,
                  "humidity": 71,
                  "cloud": 100,
                  "feelslike_c": 3.5,
                  "feelslike_f": 38.4,
                  "windchill_c": 3.5,
                  "windchill_f": 38.4,
                  "heatindex_c": 7.2,
                  "heatindex_f": 44.9,
                  "dewpoint_c": 2.4,
                  "dewpoint_f": 36.3,
                  "will_it_rain": 1,
                  "chance_of_rain": 76,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 10,
                  "vis_miles": 6,
                  "gust_mph": 19.8,
                  "gust_kph": 31.9,
                  "uv": 0.1
                },
                {
                  "time_epoch": 1764000000,
                  "time": "2025-11-24 16:00",
                  "temp_c": 6.2,
                  "temp_f": 43.2,
                  "is_day": 0,
                  "condition": {
                    "text": "Patchy rain nearby",
                    "icon": "//cdn.weatherapi.com/weather/64x64/night/176.png",
                    "code": 1063
                  },
                  "wind_mph": 15.2,
                  "wind_kph": 24.5,
                  "wind_degree": 327,
                  "wind_dir": "NNW",
                  "pressure_mb": 996,
                  "pressure_in": 29.42,
                  "precip_mm": 0.08,
                  "precip_in": 0,
                  "snow_cm": 0,
                  "humidity": 79,
                  "cloud": 100,
                  "feelslike_c": 2.1,
                  "feelslike_f": 35.8,
                  "windchill_c": 2.1,
                  "windchill_f": 35.8,
                  "heatindex_c": 6.2,
                  "heatindex_f": 43.2,
                  "dewpoint_c": 3,
                  "dewpoint_f": 37.3,
                  "will_it_rain": 1,
                  "chance_of_rain": 100,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 10,
                  "vis_miles": 6,
                  "gust_mph": 21,
                  "gust_kph": 33.8,
                  "uv": 0
                },
                {
                  "time_epoch": 1764003600,
                  "time": "2025-11-24 17:00",
                  "temp_c": 6.3,
                  "temp_f": 43.3,
                  "is_day": 0,
                  "condition": {
                    "text": "Patchy rain nearby",
                    "icon": "//cdn.weatherapi.com/weather/64x64/night/176.png",
                    "code": 1063
                  },
                  "wind_mph": 15.4,
                  "wind_kph": 24.8,
                  "wind_degree": 333,
                  "wind_dir": "NNW",
                  "pressure_mb": 997,
                  "pressure_in": 29.45,
                  "precip_mm": 0.12,
                  "precip_in": 0,
                  "snow_cm": 0,
                  "humidity": 85,
                  "cloud": 100,
                  "feelslike_c": 2.2,
                  "feelslike_f": 36,
                  "windchill_c": 2.2,
                  "windchill_f": 36,
                  "heatindex_c": 6.3,
                  "heatindex_f": 43.3,
                  "dewpoint_c": 3.9,
                  "dewpoint_f": 39,
                  "will_it_rain": 1,
                  "chance_of_rain": 100,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 10,
                  "vis_miles": 6,
                  "gust_mph": 21.6,
                  "gust_kph": 34.7,
                  "uv": 0
                },
                {
                  "time_epoch": 1764007200,
                  "time": "2025-11-24 18:00",
                  "temp_c": 6.6,
                  "temp_f": 43.9,
                  "is_day": 0,
                  "condition": {
                    "text": "Patchy rain nearby",
                    "icon": "//cdn.weatherapi.com/weather/64x64/night/176.png",
                    "code": 1063
                  },
                  "wind_mph": 16.3,
                  "wind_kph": 26.3,
                  "wind_degree": 338,
                  "wind_dir": "NNW",
                  "pressure_mb": 999,
                  "pressure_in": 29.49,
                  "precip_mm": 0.01,
                  "precip_in": 0,
                  "snow_cm": 0,
                  "humidity": 83,
                  "cloud": 100,
                  "feelslike_c": 2.5,
                  "feelslike_f": 36.4,
                  "windchill_c": 2.5,
                  "windchill_f": 36.4,
                  "heatindex_c": 6.6,
                  "heatindex_f": 43.9,
                  "dewpoint_c": 3.9,
                  "dewpoint_f": 39,
                  "will_it_rain": 1,
                  "chance_of_rain": 75,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 10,
                  "vis_miles": 6,
                  "gust_mph": 22.9,
                  "gust_kph": 36.9,
                  "uv": 0
                },
                {
                  "time_epoch": 1764010800,
                  "time": "2025-11-24 19:00",
                  "temp_c": 6.4,
                  "temp_f": 43.5,
                  "is_day": 0,
                  "condition": {
                    "text": "Patchy rain nearby",
                    "icon": "//cdn.weatherapi.com/weather/64x64/night/176.png",
                    "code": 1063
                  },
                  "wind_mph": 16.3,
                  "wind_kph": 26.3,
                  "wind_degree": 343,
                  "wind_dir": "NNW",
                  "pressure_mb": 1000,
                  "pressure_in": 29.54,
                  "precip_mm": 0.01,
                  "precip_in": 0,
                  "snow_cm": 0,
                  "humidity": 81,
                  "cloud": 100,
                  "feelslike_c": 2.2,
                  "feelslike_f": 35.9,
                  "windchill_c": 2.2,
                  "windchill_f": 35.9,
                  "heatindex_c": 6.4,
                  "heatindex_f": 43.5,
                  "dewpoint_c": 3.3,
                  "dewpoint_f": 38,
                  "will_it_rain": 1,
                  "chance_of_rain": 73,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 10,
                  "vis_miles": 6,
                  "gust_mph": 22.8,
                  "gust_kph": 36.7,
                  "uv": 0
                },
                {
                  "time_epoch": 1764014400,
                  "time": "2025-11-24 20:00",
                  "temp_c": 6.5,
                  "temp_f": 43.8,
                  "is_day": 0,
                  "condition": {
                    "text": "Patchy rain nearby",
                    "icon": "//cdn.weatherapi.com/weather/64x64/night/176.png",
                    "code": 1063
                  },
                  "wind_mph": 15.9,
                  "wind_kph": 25.6,
                  "wind_degree": 349,
                  "wind_dir": "N",
                  "pressure_mb": 1002,
                  "pressure_in": 29.58,
                  "precip_mm": 0.01,
                  "precip_in": 0,
                  "snow_cm": 0,
                  "humidity": 73,
                  "cloud": 100,
                  "feelslike_c": 2.4,
                  "feelslike_f": 36.4,
                  "windchill_c": 2.4,
                  "windchill_f": 36.4,
                  "heatindex_c": 6.5,
                  "heatindex_f": 43.8,
                  "dewpoint_c": 2,
                  "dewpoint_f": 35.6,
                  "will_it_rain": 1,
                  "chance_of_rain": 84,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 10,
                  "vis_miles": 6,
                  "gust_mph": 22.6,
                  "gust_kph": 36.4,
                  "uv": 0
                },
                {
                  "time_epoch": 1764018000,
                  "time": "2025-11-24 21:00",
                  "temp_c": 6.2,
                  "temp_f": 43.2,
                  "is_day": 0,
                  "condition": {
                    "text": "Partly Cloudy ",
                    "icon": "//cdn.weatherapi.com/weather/64x64/night/116.png",
                    "code": 1003
                  },
                  "wind_mph": 14.5,
                  "wind_kph": 23.4,
                  "wind_degree": 349,
                  "wind_dir": "N",
                  "pressure_mb": 1003,
                  "pressure_in": 29.62,
                  "precip_mm": 0,
                  "precip_in": 0,
                  "snow_cm": 0,
                  "humidity": 69,
                  "cloud": 56,
                  "feelslike_c": 2.3,
                  "feelslike_f": 36.1,
                  "windchill_c": 2.3,
                  "windchill_f": 36.1,
                  "heatindex_c": 6.2,
                  "heatindex_f": 43.2,
                  "dewpoint_c": 1.1,
                  "dewpoint_f": 33.9,
                  "will_it_rain": 0,
                  "chance_of_rain": 0,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 10,
                  "vis_miles": 6,
                  "gust_mph": 20.8,
                  "gust_kph": 33.6,
                  "uv": 0
                },
                {
                  "time_epoch": 1764021600,
                  "time": "2025-11-24 22:00",
                  "temp_c": 5.8,
                  "temp_f": 42.4,
                  "is_day": 0,
                  "condition": {
                    "text": "Clear ",
                    "icon": "//cdn.weatherapi.com/weather/64x64/night/113.png",
                    "code": 1000
                  },
                  "wind_mph": 13.2,
                  "wind_kph": 21.2,
                  "wind_degree": 342,
                  "wind_dir": "NNW",
                  "pressure_mb": 1004,
                  "pressure_in": 29.65,
                  "precip_mm": 0,
                  "precip_in": 0,
                  "snow_cm": 0,
                  "humidity": 65,
                  "cloud": 11,
                  "feelslike_c": 1.9,
                  "feelslike_f": 35.4,
                  "windchill_c": 1.9,
                  "windchill_f": 35.4,
                  "heatindex_c": 5.8,
                  "heatindex_f": 42.4,
                  "dewpoint_c": -0.3,
                  "dewpoint_f": 31.4,
                  "will_it_rain": 0,
                  "chance_of_rain": 0,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 10,
                  "vis_miles": 6,
                  "gust_mph": 19.9,
                  "gust_kph": 32,
                  "uv": 0
                },
                {
                  "time_epoch": 1764025200,
                  "time": "2025-11-24 23:00",
                  "temp_c": 5.1,
                  "temp_f": 41.1,
                  "is_day": 0,
                  "condition": {
                    "text": "Clear ",
                    "icon": "//cdn.weatherapi.com/weather/64x64/night/113.png",
                    "code": 1000
                  },
                  "wind_mph": 13.2,
                  "wind_kph": 21.2,
                  "wind_degree": 335,
                  "wind_dir": "NNW",
                  "pressure_mb": 1005,
                  "pressure_in": 29.68,
                  "precip_mm": 0,
                  "precip_in": 0,
                  "snow_cm": 0,
                  "humidity": 67,
                  "cloud": 10,
                  "feelslike_c": 1,
                  "feelslike_f": 33.8,
                  "windchill_c": 1,
                  "windchill_f": 33.8,
                  "heatindex_c": 5.1,
                  "heatindex_f": 41.1,
                  "dewpoint_c": -0.6,
                  "dewpoint_f": 31,
                  "will_it_rain": 0,
                  "chance_of_rain": 0,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 10,
                  "vis_miles": 6,
                  "gust_mph": 19.8,
                  "gust_kph": 31.8,
                  "uv": 0
                }
              ]
            },
            {
              "date": "2025-11-25",
              "date_epoch": 1764028800,
              "day": {
                "maxtemp_c": 6.7,
                "maxtemp_f": 44.1,
                "mintemp_c": 3.7,
                "mintemp_f": 38.6,
                "avgtemp_c": 4.8,
                "avgtemp_f": 40.6,
                "maxwind_mph": 13,
                "maxwind_kph": 20.9,
                "totalprecip_mm": 0,
                "totalprecip_in": 0,
                "totalsnow_cm": 0,
                "avgvis_km": 10,
                "avgvis_miles": 6,
                "avghumidity": 75,
                "daily_will_it_rain": 0,
                "daily_chance_of_rain": 0,
                "daily_will_it_snow": 0,
                "daily_chance_of_snow": 0,
                "condition": {
                  "text": "Partly Cloudy ",
                  "icon": "//cdn.weatherapi.com/weather/64x64/day/116.png",
                  "code": 1003
                },
                "uv": 0.1
              },
              "astro": {
                "sunrise": "07:36 AM",
                "sunset": "03:59 PM",
                "moonrise": "12:10 PM",
                "moonset": "08:09 PM",
                "moon_phase": "Waxing Crescent",
                "moon_illumination": 19,
                "is_moon_up": 0,
                "is_sun_up": 0
              },
              "hour": [
                {
                  "time_epoch": 1764028800,
                  "time": "2025-11-25 00:00",
                  "temp_c": 4.9,
                  "temp_f": 40.7,
                  "is_day": 0,
                  "condition": {
                    "text": "Clear ",
                    "icon": "//cdn.weatherapi.com/weather/64x64/night/113.png",
                    "code": 1000
                  },
                  "wind_mph": 13,
                  "wind_kph": 20.9,
                  "wind_degree": 332,
                  "wind_dir": "NNW",
                  "pressure_mb": 1006,
                  "pressure_in": 29.7,
                  "precip_mm": 0,
                  "precip_in": 0,
                  "snow_cm": 0,
                  "humidity": 70,
                  "cloud": 19,
                  "feelslike_c": 0.8,
                  "feelslike_f": 33.4,
                  "windchill_c": 0.8,
                  "windchill_f": 33.4,
                  "heatindex_c": 4.9,
                  "heatindex_f": 40.7,
                  "dewpoint_c": -0.2,
                  "dewpoint_f": 31.7,
                  "will_it_rain": 0,
                  "chance_of_rain": 0,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 10,
                  "vis_miles": 6,
                  "gust_mph": 19.8,
                  "gust_kph": 31.9,
                  "uv": 0
                },
                {
                  "time_epoch": 1764032400,
                  "time": "2025-11-25 01:00",
                  "temp_c": 4.7,
                  "temp_f": 40.5,
                  "is_day": 0,
                  "condition": {
                    "text": "Clear ",
                    "icon": "//cdn.weatherapi.com/weather/64x64/night/113.png",
                    "code": 1000
                  },
                  "wind_mph": 12.5,
                  "wind_kph": 20.2,
                  "wind_degree": 329,
                  "wind_dir": "NNW",
                  "pressure_mb": 1007,
                  "pressure_in": 29.72,
                  "precip_mm": 0,
                  "precip_in": 0,
                  "snow_cm": 0,
                  "humidity": 71,
                  "cloud": 15,
                  "feelslike_c": 0.7,
                  "feelslike_f": 33.3,
                  "windchill_c": 0.7,
                  "windchill_f": 33.3,
                  "heatindex_c": 4.7,
                  "heatindex_f": 40.5,
                  "dewpoint_c": 0,
                  "dewpoint_f": 32,
                  "will_it_rain": 0,
                  "chance_of_rain": 0,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 10,
                  "vis_miles": 6,
                  "gust_mph": 19.2,
                  "gust_kph": 30.9,
                  "uv": 0
                },
                {
                  "time_epoch": 1764036000,
                  "time": "2025-11-25 02:00",
                  "temp_c": 4.5,
                  "temp_f": 40,
                  "is_day": 0,
                  "condition": {
                    "text": "Clear ",
                    "icon": "//cdn.weatherapi.com/weather/64x64/night/113.png",
                    "code": 1000
                  },
                  "wind_mph": 12.8,
                  "wind_kph": 20.5,
                  "wind_degree": 328,
                  "wind_dir": "NNW",
                  "pressure_mb": 1008,
                  "pressure_in": 29.76,
                  "precip_mm": 0,
                  "precip_in": 0,
                  "snow_cm": 0,
                  "humidity": 74,
                  "cloud": 25,
                  "feelslike_c": 0.3,
                  "feelslike_f": 32.6,
                  "windchill_c": 0.3,
                  "windchill_f": 32.6,
                  "heatindex_c": 4.5,
                  "heatindex_f": 40,
                  "dewpoint_c": 0.2,
                  "dewpoint_f": 32.3,
                  "will_it_rain": 0,
                  "chance_of_rain": 0,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 10,
                  "vis_miles": 6,
                  "gust_mph": 19.3,
                  "gust_kph": 31.1,
                  "uv": 0
                },
                {
                  "time_epoch": 1764039600,
                  "time": "2025-11-25 03:00",
                  "temp_c": 4.2,
                  "temp_f": 39.6,
                  "is_day": 0,
                  "condition": {
                    "text": "Partly Cloudy ",
                    "icon": "//cdn.weatherapi.com/weather/64x64/night/116.png",
                    "code": 1003
                  },
                  "wind_mph": 11.9,
                  "wind_kph": 19.1,
                  "wind_degree": 329,
                  "wind_dir": "NNW",
                  "pressure_mb": 1008,
                  "pressure_in": 29.77,
                  "precip_mm": 0,
                  "precip_in": 0,
                  "snow_cm": 0,
                  "humidity": 81,
                  "cloud": 39,
                  "feelslike_c": 0.2,
                  "feelslike_f": 32.4,
                  "windchill_c": 0.2,
                  "windchill_f": 32.4,
                  "heatindex_c": 4.2,
                  "heatindex_f": 39.6,
                  "dewpoint_c": 1.2,
                  "dewpoint_f": 34.2,
                  "will_it_rain": 0,
                  "chance_of_rain": 0,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 10,
                  "vis_miles": 6,
                  "gust_mph": 17.7,
                  "gust_kph": 28.5,
                  "uv": 0
                },
                {
                  "time_epoch": 1764043200,
                  "time": "2025-11-25 04:00",
                  "temp_c": 4,
                  "temp_f": 39.2,
                  "is_day": 0,
                  "condition": {
                    "text": "Partly Cloudy ",
                    "icon": "//cdn.weatherapi.com/weather/64x64/night/116.png",
                    "code": 1003
                  },
                  "wind_mph": 11.6,
                  "wind_kph": 18.7,
                  "wind_degree": 328,
                  "wind_dir": "NNW",
                  "pressure_mb": 1009,
                  "pressure_in": 29.79,
                  "precip_mm": 0,
                  "precip_in": 0,
                  "snow_cm": 0,
                  "humidity": 85,
                  "cloud": 34,
                  "feelslike_c": -0.1,
                  "feelslike_f": 31.9,
                  "windchill_c": -0.1,
                  "windchill_f": 31.9,
                  "heatindex_c": 4,
                  "heatindex_f": 39.2,
                  "dewpoint_c": 1.7,
                  "dewpoint_f": 35,
                  "will_it_rain": 0,
                  "chance_of_rain": 0,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 10,
                  "vis_miles": 6,
                  "gust_mph": 17.3,
                  "gust_kph": 27.8,
                  "uv": 0
                },
                {
                  "time_epoch": 1764046800,
                  "time": "2025-11-25 05:00",
                  "temp_c": 3.8,
                  "temp_f": 38.8,
                  "is_day": 0,
                  "condition": {
                    "text": "Partly Cloudy ",
                    "icon": "//cdn.weatherapi.com/weather/64x64/night/116.png",
                    "code": 1003
                  },
                  "wind_mph": 11.2,
                  "wind_kph": 18,
                  "wind_degree": 326,
                  "wind_dir": "NNW",
                  "pressure_mb": 1010,
                  "pressure_in": 29.81,
                  "precip_mm": 0,
                  "precip_in": 0,
                  "snow_cm": 0,
                  "humidity": 86,
                  "cloud": 39,
                  "feelslike_c": -0.2,
                  "feelslike_f": 31.7,
                  "windchill_c": -0.2,
                  "windchill_f": 31.7,
                  "heatindex_c": 3.8,
                  "heatindex_f": 38.8,
                  "dewpoint_c": 1.7,
                  "dewpoint_f": 35.1,
                  "will_it_rain": 0,
                  "chance_of_rain": 0,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 10,
                  "vis_miles": 6,
                  "gust_mph": 16.6,
                  "gust_kph": 26.8,
                  "uv": 0
                },
                {
                  "time_epoch": 1764050400,
                  "time": "2025-11-25 06:00",
                  "temp_c": 3.8,
                  "temp_f": 38.9,
                  "is_day": 0,
                  "condition": {
                    "text": "Partly Cloudy ",
                    "icon": "//cdn.weatherapi.com/weather/64x64/night/116.png",
                    "code": 1003
                  },
                  "wind_mph": 10.1,
                  "wind_kph": 16.2,
                  "wind_degree": 324,
                  "wind_dir": "NW",
                  "pressure_mb": 1010,
                  "pressure_in": 29.84,
                  "precip_mm": 0,
                  "precip_in": 0,
                  "snow_cm": 0,
                  "humidity": 86,
                  "cloud": 40,
                  "feelslike_c": 0.1,
                  "feelslike_f": 32.2,
                  "windchill_c": 0.1,
                  "windchill_f": 32.2,
                  "heatindex_c": 3.8,
                  "heatindex_f": 38.9,
                  "dewpoint_c": 1.7,
                  "dewpoint_f": 35.1,
                  "will_it_rain": 0,
                  "chance_of_rain": 0,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 10,
                  "vis_miles": 6,
                  "gust_mph": 15.2,
                  "gust_kph": 24.4,
                  "uv": 0
                },
                {
                  "time_epoch": 1764054000,
                  "time": "2025-11-25 07:00",
                  "temp_c": 3.8,
                  "temp_f": 38.9,
                  "is_day": 0,
                  "condition": {
                    "text": "Partly Cloudy ",
                    "icon": "//cdn.weatherapi.com/weather/64x64/night/116.png",
                    "code": 1003
                  },
                  "wind_mph": 9.4,
                  "wind_kph": 15.1,
                  "wind_degree": 327,
                  "wind_dir": "NNW",
                  "pressure_mb": 1011,
                  "pressure_in": 29.86,
                  "precip_mm": 0,
                  "precip_in": 0,
                  "snow_cm": 0,
                  "humidity": 85,
                  "cloud": 41,
                  "feelslike_c": 0.3,
                  "feelslike_f": 32.6,
                  "windchill_c": 0.3,
                  "windchill_f": 32.6,
                  "heatindex_c": 3.9,
                  "heatindex_f": 38.9,
                  "dewpoint_c": 1.6,
                  "dewpoint_f": 35,
                  "will_it_rain": 0,
                  "chance_of_rain": 0,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 10,
                  "vis_miles": 6,
                  "gust_mph": 14.3,
                  "gust_kph": 23,
                  "uv": 0
                },
                {
                  "time_epoch": 1764057600,
                  "time": "2025-11-25 08:00",
                  "temp_c": 3.7,
                  "temp_f": 38.7,
                  "is_day": 1,
                  "condition": {
                    "text": "Overcast ",
                    "icon": "//cdn.weatherapi.com/weather/64x64/day/122.png",
                    "code": 1009
                  },
                  "wind_mph": 9.4,
                  "wind_kph": 15.1,
                  "wind_degree": 329,
                  "wind_dir": "NNW",
                  "pressure_mb": 1012,
                  "pressure_in": 29.89,
                  "precip_mm": 0,
                  "precip_in": 0,
                  "snow_cm": 0,
                  "humidity": 89,
                  "cloud": 100,
                  "feelslike_c": 0.2,
                  "feelslike_f": 32.3,
                  "windchill_c": 0.2,
                  "windchill_f": 32.3,
                  "heatindex_c": 3.7,
                  "heatindex_f": 38.7,
                  "dewpoint_c": 2,
                  "dewpoint_f": 35.7,
                  "will_it_rain": 0,
                  "chance_of_rain": 0,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 10,
                  "vis_miles": 6,
                  "gust_mph": 14,
                  "gust_kph": 22.5,
                  "uv": 0
                },
                {
                  "time_epoch": 1764061200,
                  "time": "2025-11-25 09:00",
                  "temp_c": 4.6,
                  "temp_f": 40.3,
                  "is_day": 1,
                  "condition": {
                    "text": "Overcast ",
                    "icon": "//cdn.weatherapi.com/weather/64x64/day/122.png",
                    "code": 1009
                  },
                  "wind_mph": 11,
                  "wind_kph": 17.6,
                  "wind_degree": 334,
                  "wind_dir": "NNW",
                  "pressure_mb": 1013,
                  "pressure_in": 29.91,
                  "precip_mm": 0,
                  "precip_in": 0,
                  "snow_cm": 0,
                  "humidity": 82,
                  "cloud": 100,
                  "feelslike_c": 0.9,
                  "feelslike_f": 33.5,
                  "windchill_c": 0.9,
                  "windchill_f": 33.5,
                  "heatindex_c": 4.6,
                  "heatindex_f": 40.3,
                  "dewpoint_c": 1.9,
                  "dewpoint_f": 35.4,
                  "will_it_rain": 0,
                  "chance_of_rain": 0,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 10,
                  "vis_miles": 6,
                  "gust_mph": 15.3,
                  "gust_kph": 24.7,
                  "uv": 0.1
                },
                {
                  "time_epoch": 1764064800,
                  "time": "2025-11-25 10:00",
                  "temp_c": 5.5,
                  "temp_f": 41.9,
                  "is_day": 1,
                  "condition": {
                    "text": "Cloudy ",
                    "icon": "//cdn.weatherapi.com/weather/64x64/day/119.png",
                    "code": 1006
                  },
                  "wind_mph": 9.8,
                  "wind_kph": 15.8,
                  "wind_degree": 336,
                  "wind_dir": "NNW",
                  "pressure_mb": 1013,
                  "pressure_in": 29.93,
                  "precip_mm": 0,
                  "precip_in": 0,
                  "snow_cm": 0,
                  "humidity": 74,
                  "cloud": 69,
                  "feelslike_c": 2.3,
                  "feelslike_f": 36.1,
                  "windchill_c": 2.3,
                  "windchill_f": 36.1,
                  "heatindex_c": 5.5,
                  "heatindex_f": 42,
                  "dewpoint_c": 1.3,
                  "dewpoint_f": 34.3,
                  "will_it_rain": 0,
                  "chance_of_rain": 0,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 10,
                  "vis_miles": 6,
                  "gust_mph": 13.7,
                  "gust_kph": 22,
                  "uv": 0.3
                },
                {
                  "time_epoch": 1764068400,
                  "time": "2025-11-25 11:00",
                  "temp_c": 6.1,
                  "temp_f": 43,
                  "is_day": 1,
                  "condition": {
                    "text": "Sunny",
                    "icon": "//cdn.weatherapi.com/weather/64x64/day/113.png",
                    "code": 1000
                  },
                  "wind_mph": 9.8,
                  "wind_kph": 15.8,
                  "wind_degree": 327,
                  "wind_dir": "NNW",
                  "pressure_mb": 1014,
                  "pressure_in": 29.94,
                  "precip_mm": 0,
                  "precip_in": 0,
                  "snow_cm": 0,
                  "humidity": 69,
                  "cloud": 15,
                  "feelslike_c": 3,
                  "feelslike_f": 37.4,
                  "windchill_c": 3,
                  "windchill_f": 37.4,
                  "heatindex_c": 6.1,
                  "heatindex_f": 43,
                  "dewpoint_c": 0.9,
                  "dewpoint_f": 33.5,
                  "will_it_rain": 0,
                  "chance_of_rain": 0,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 10,
                  "vis_miles": 6,
                  "gust_mph": 12.6,
                  "gust_kph": 20.3,
                  "uv": 0.6
                },
                {
                  "time_epoch": 1764072000,
                  "time": "2025-11-25 12:00",
                  "temp_c": 6.6,
                  "temp_f": 43.8,
                  "is_day": 1,
                  "condition": {
                    "text": "Partly Cloudy ",
                    "icon": "//cdn.weatherapi.com/weather/64x64/day/116.png",
                    "code": 1003
                  },
                  "wind_mph": 10.7,
                  "wind_kph": 17.3,
                  "wind_degree": 329,
                  "wind_dir": "NNW",
                  "pressure_mb": 1014,
                  "pressure_in": 29.93,
                  "precip_mm": 0,
                  "precip_in": 0,
                  "snow_cm": 0,
                  "humidity": 64,
                  "cloud": 34,
                  "feelslike_c": 3.4,
                  "feelslike_f": 38.1,
                  "windchill_c": 3.4,
                  "windchill_f": 38.1,
                  "heatindex_c": 6.6,
                  "heatindex_f": 43.8,
                  "dewpoint_c": 0.4,
                  "dewpoint_f": 32.7,
                  "will_it_rain": 0,
                  "chance_of_rain": 0,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 10,
                  "vis_miles": 6,
                  "gust_mph": 13.5,
                  "gust_kph": 21.7,
                  "uv": 0.7
                },
                {
                  "time_epoch": 1764075600,
                  "time": "2025-11-25 13:00",
                  "temp_c": 6.7,
                  "temp_f": 44.1,
                  "is_day": 1,
                  "condition": {
                    "text": "Cloudy ",
                    "icon": "//cdn.weatherapi.com/weather/64x64/day/119.png",
                    "code": 1006
                  },
                  "wind_mph": 11.2,
                  "wind_kph": 18,
                  "wind_degree": 331,
                  "wind_dir": "NNW",
                  "pressure_mb": 1014,
                  "pressure_in": 29.94,
                  "precip_mm": 0,
                  "precip_in": 0,
                  "snow_cm": 0,
                  "humidity": 65,
                  "cloud": 75,
                  "feelslike_c": 3.4,
                  "feelslike_f": 38.2,
                  "windchill_c": 3.4,
                  "windchill_f": 38.2,
                  "heatindex_c": 6.7,
                  "heatindex_f": 44.1,
                  "dewpoint_c": 0.6,
                  "dewpoint_f": 33.1,
                  "will_it_rain": 0,
                  "chance_of_rain": 0,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 10,
                  "vis_miles": 6,
                  "gust_mph": 14,
                  "gust_kph": 22.6,
                  "uv": 0.6
                },
                {
                  "time_epoch": 1764079200,
                  "time": "2025-11-25 14:00",
                  "temp_c": 6.5,
                  "temp_f": 43.8,
                  "is_day": 1,
                  "condition": {
                    "text": "Overcast ",
                    "icon": "//cdn.weatherapi.com/weather/64x64/day/122.png",
                    "code": 1009
                  },
                  "wind_mph": 10.7,
                  "wind_kph": 17.3,
                  "wind_degree": 335,
                  "wind_dir": "NNW",
                  "pressure_mb": 1014,
                  "pressure_in": 29.95,
                  "precip_mm": 0,
                  "precip_in": 0,
                  "snow_cm": 0,
                  "humidity": 66,
                  "cloud": 91,
                  "feelslike_c": 3.3,
                  "feelslike_f": 38,
                  "windchill_c": 3.3,
                  "windchill_f": 38,
                  "heatindex_c": 6.5,
                  "heatindex_f": 43.8,
                  "dewpoint_c": 0.8,
                  "dewpoint_f": 33.4,
                  "will_it_rain": 0,
                  "chance_of_rain": 0,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 10,
                  "vis_miles": 6,
                  "gust_mph": 13.9,
                  "gust_kph": 22.4,
                  "uv": 0.4
                },
                {
                  "time_epoch": 1764082800,
                  "time": "2025-11-25 15:00",
                  "temp_c": 6.2,
                  "temp_f": 43.2,
                  "is_day": 1,
                  "condition": {
                    "text": "Cloudy ",
                    "icon": "//cdn.weatherapi.com/weather/64x64/day/119.png",
                    "code": 1006
                  },
                  "wind_mph": 10.5,
                  "wind_kph": 16.9,
                  "wind_degree": 340,
                  "wind_dir": "NNW",
                  "pressure_mb": 1015,
                  "pressure_in": 29.97,
                  "precip_mm": 0,
                  "precip_in": 0,
                  "snow_cm": 0,
                  "humidity": 68,
                  "cloud": 85,
                  "feelslike_c": 3,
                  "feelslike_f": 37.4,
                  "windchill_c": 3,
                  "windchill_f": 37.4,
                  "heatindex_c": 6.2,
                  "heatindex_f": 43.2,
                  "dewpoint_c": 0.8,
                  "dewpoint_f": 33.4,
                  "will_it_rain": 0,
                  "chance_of_rain": 0,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 10,
                  "vis_miles": 6,
                  "gust_mph": 14.3,
                  "gust_kph": 23.1,
                  "uv": 0.2
                },
                {
                  "time_epoch": 1764086400,
                  "time": "2025-11-25 16:00",
                  "temp_c": 5.6,
                  "temp_f": 42,
                  "is_day": 0,
                  "condition": {
                    "text": "Partly Cloudy ",
                    "icon": "//cdn.weatherapi.com/weather/64x64/night/116.png",
                    "code": 1003
                  },
                  "wind_mph": 8.9,
                  "wind_kph": 14.4,
                  "wind_degree": 332,
                  "wind_dir": "NNW",
                  "pressure_mb": 1015,
                  "pressure_in": 29.98,
                  "precip_mm": 0,
                  "precip_in": 0,
                  "snow_cm": 0,
                  "humidity": 72,
                  "cloud": 27,
                  "feelslike_c": 2.5,
                  "feelslike_f": 36.6,
                  "windchill_c": 2.5,
                  "windchill_f": 36.6,
                  "heatindex_c": 5.6,
                  "heatindex_f": 42,
                  "dewpoint_c": 1,
                  "dewpoint_f": 33.8,
                  "will_it_rain": 0,
                  "chance_of_rain": 0,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 10,
                  "vis_miles": 6,
                  "gust_mph": 12.8,
                  "gust_kph": 20.7,
                  "uv": 0
                },
                {
                  "time_epoch": 1764090000,
                  "time": "2025-11-25 17:00",
                  "temp_c": 4.9,
                  "temp_f": 40.8,
                  "is_day": 0,
                  "condition": {
                    "text": "Partly Cloudy ",
                    "icon": "//cdn.weatherapi.com/weather/64x64/night/116.png",
                    "code": 1003
                  },
                  "wind_mph": 8.7,
                  "wind_kph": 14,
                  "wind_degree": 328,
                  "wind_dir": "NNW",
                  "pressure_mb": 1016,
                  "pressure_in": 30,
                  "precip_mm": 0,
                  "precip_in": 0,
                  "snow_cm": 0,
                  "humidity": 75,
                  "cloud": 38,
                  "feelslike_c": 1.8,
                  "feelslike_f": 35.2,
                  "windchill_c": 1.8,
                  "windchill_f": 35.2,
                  "heatindex_c": 4.9,
                  "heatindex_f": 40.8,
                  "dewpoint_c": 0.9,
                  "dewpoint_f": 33.5,
                  "will_it_rain": 0,
                  "chance_of_rain": 0,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 10,
                  "vis_miles": 6,
                  "gust_mph": 13.2,
                  "gust_kph": 21.2,
                  "uv": 0
                },
                {
                  "time_epoch": 1764093600,
                  "time": "2025-11-25 18:00",
                  "temp_c": 4.6,
                  "temp_f": 40.3,
                  "is_day": 0,
                  "condition": {
                    "text": "Clear ",
                    "icon": "//cdn.weatherapi.com/weather/64x64/night/113.png",
                    "code": 1000
                  },
                  "wind_mph": 9.4,
                  "wind_kph": 15.1,
                  "wind_degree": 330,
                  "wind_dir": "NNW",
                  "pressure_mb": 1016,
                  "pressure_in": 30.02,
                  "precip_mm": 0,
                  "precip_in": 0,
                  "snow_cm": 0,
                  "humidity": 74,
                  "cloud": 23,
                  "feelslike_c": 1.3,
                  "feelslike_f": 34.3,
                  "windchill_c": 1.3,
                  "windchill_f": 34.3,
                  "heatindex_c": 4.6,
                  "heatindex_f": 40.3,
                  "dewpoint_c": 0.4,
                  "dewpoint_f": 32.8,
                  "will_it_rain": 0,
                  "chance_of_rain": 0,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 10,
                  "vis_miles": 6,
                  "gust_mph": 14.4,
                  "gust_kph": 23.1,
                  "uv": 0
                },
                {
                  "time_epoch": 1764097200,
                  "time": "2025-11-25 19:00",
                  "temp_c": 4.4,
                  "temp_f": 39.9,
                  "is_day": 0,
                  "condition": {
                    "text": "Partly Cloudy ",
                    "icon": "//cdn.weatherapi.com/weather/64x64/night/116.png",
                    "code": 1003
                  },
                  "wind_mph": 9.4,
                  "wind_kph": 15.1,
                  "wind_degree": 331,
                  "wind_dir": "NNW",
                  "pressure_mb": 1017,
                  "pressure_in": 30.03,
                  "precip_mm": 0,
                  "precip_in": 0,
                  "snow_cm": 0,
                  "humidity": 74,
                  "cloud": 28,
                  "feelslike_c": 1,
                  "feelslike_f": 33.8,
                  "windchill_c": 1,
                  "windchill_f": 33.8,
                  "heatindex_c": 4.4,
                  "heatindex_f": 40,
                  "dewpoint_c": 0.2,
                  "dewpoint_f": 32.3,
                  "will_it_rain": 0,
                  "chance_of_rain": 0,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 10,
                  "vis_miles": 6,
                  "gust_mph": 14.6,
                  "gust_kph": 23.5,
                  "uv": 0
                },
                {
                  "time_epoch": 1764100800,
                  "time": "2025-11-25 20:00",
                  "temp_c": 4.3,
                  "temp_f": 39.7,
                  "is_day": 0,
                  "condition": {
                    "text": "Partly Cloudy ",
                    "icon": "//cdn.weatherapi.com/weather/64x64/night/116.png",
                    "code": 1003
                  },
                  "wind_mph": 9.4,
                  "wind_kph": 15.1,
                  "wind_degree": 329,
                  "wind_dir": "NNW",
                  "pressure_mb": 1018,
                  "pressure_in": 30.05,
                  "precip_mm": 0,
                  "precip_in": 0,
                  "snow_cm": 0,
                  "humidity": 73,
                  "cloud": 29,
                  "feelslike_c": 0.9,
                  "feelslike_f": 33.6,
                  "windchill_c": 0.9,
                  "windchill_f": 33.6,
                  "heatindex_c": 4.3,
                  "heatindex_f": 39.7,
                  "dewpoint_c": -0.1,
                  "dewpoint_f": 31.8,
                  "will_it_rain": 0,
                  "chance_of_rain": 0,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 10,
                  "vis_miles": 6,
                  "gust_mph": 14.8,
                  "gust_kph": 23.8,
                  "uv": 0
                },
                {
                  "time_epoch": 1764104400,
                  "time": "2025-11-25 21:00",
                  "temp_c": 4.1,
                  "temp_f": 39.5,
                  "is_day": 0,
                  "condition": {
                    "text": "Partly Cloudy ",
                    "icon": "//cdn.weatherapi.com/weather/64x64/night/116.png",
                    "code": 1003
                  },
                  "wind_mph": 9.2,
                  "wind_kph": 14.8,
                  "wind_degree": 329,
                  "wind_dir": "NNW",
                  "pressure_mb": 1018,
                  "pressure_in": 30.06,
                  "precip_mm": 0,
                  "precip_in": 0,
                  "snow_cm": 0,
                  "humidity": 73,
                  "cloud": 31,
                  "feelslike_c": 0.7,
                  "feelslike_f": 33.3,
                  "windchill_c": 0.7,
                  "windchill_f": 33.3,
                  "heatindex_c": 4.2,
                  "heatindex_f": 39.5,
                  "dewpoint_c": -0.3,
                  "dewpoint_f": 31.4,
                  "will_it_rain": 0,
                  "chance_of_rain": 0,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 10,
                  "vis_miles": 6,
                  "gust_mph": 14.5,
                  "gust_kph": 23.3,
                  "uv": 0
                },
                {
                  "time_epoch": 1764108000,
                  "time": "2025-11-25 22:00",
                  "temp_c": 3.9,
                  "temp_f": 39.1,
                  "is_day": 0,
                  "condition": {
                    "text": "Clear ",
                    "icon": "//cdn.weatherapi.com/weather/64x64/night/113.png",
                    "code": 1000
                  },
                  "wind_mph": 8.5,
                  "wind_kph": 13.7,
                  "wind_degree": 332,
                  "wind_dir": "NNW",
                  "pressure_mb": 1018,
                  "pressure_in": 30.06,
                  "precip_mm": 0,
                  "precip_in": 0,
                  "snow_cm": 0,
                  "humidity": 73,
                  "cloud": 25,
                  "feelslike_c": 0.6,
                  "feelslike_f": 33.2,
                  "windchill_c": 0.6,
                  "windchill_f": 33.2,
                  "heatindex_c": 3.9,
                  "heatindex_f": 39.1,
                  "dewpoint_c": -0.4,
                  "dewpoint_f": 31.2,
                  "will_it_rain": 0,
                  "chance_of_rain": 0,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 10,
                  "vis_miles": 6,
                  "gust_mph": 13.5,
                  "gust_kph": 21.7,
                  "uv": 0
                },
                {
                  "time_epoch": 1764111600,
                  "time": "2025-11-25 23:00",
                  "temp_c": 3.7,
                  "temp_f": 38.6,
                  "is_day": 0,
                  "condition": {
                    "text": "Clear ",
                    "icon": "//cdn.weatherapi.com/weather/64x64/night/113.png",
                    "code": 1000
                  },
                  "wind_mph": 8.3,
                  "wind_kph": 13.3,
                  "wind_degree": 327,
                  "wind_dir": "NNW",
                  "pressure_mb": 1018,
                  "pressure_in": 30.07,
                  "precip_mm": 0,
                  "precip_in": 0,
                  "snow_cm": 0,
                  "humidity": 74,
                  "cloud": 24,
                  "feelslike_c": 0.4,
                  "feelslike_f": 32.8,
                  "windchill_c": 0.4,
                  "windchill_f": 32.8,
                  "heatindex_c": 3.7,
                  "heatindex_f": 38.6,
                  "dewpoint_c": -0.5,
                  "dewpoint_f": 31.1,
                  "will_it_rain": 0,
                  "chance_of_rain": 0,
                  "will_it_snow": 0,
                  "chance_of_snow": 0,
                  "vis_km": 10,
                  "vis_miles": 6,
                  "gust_mph": 13.2,
                  "gust_kph": 21.2,
                  "uv": 0
                }
              ]
            }
          ]
        }
      },
      "headers": {
        "date": "Sun, 23 Nov 2025 11:09:26 GMT",
        "content-type": "application/json",
        "transfer-encoding": "chunked",
        "connection": "keep-alive",
        "server": "BunnyCDN-DE1-752",
        "cdn-pullzone": "93447",
        "cdn-requestcountrycode": "SE",
        "vary": "Accept-Encoding",
        "age": "0",
        "cache-control": "public, max-age=180",
        "via": "1.1 varnish (Varnish/7.1)",
        "x-weatherapi-qpm-left": "999976",
        "x-varnish": "456118472",
        "cdn-proxyver": "1.40",
        "cdn-requestpullsuccess": "True",
        "cdn-requestpullcode": "200",
        "cdn-cachedat": "11/23/2025 11:09:26",
        "cdn-edgestorageid": "755",
        "cdn-requestid": "3bf3c4864e74adf4b1c9ab30ab8cb410",
        "cdn-cache": "EXPIRED",
        "cdn-status": "200",
        "cdn-requesttime": "0"
      }
    }
  },
  {
    "request": {
      "method": "GET",
      "url": "https://v3.football.api-sports.io/fixtures",
      "headers": {
        "x-rapidapi-key": "52dd...5e7f",
        "x-rapidapi-host": "api-football-v1.p.rapidapi.com"
      },
      "queryParams": {
        "season": "2022",
        "team": "51"
      }
    },
    "response": {
      "status": 200,
      "data": {
        "get": "fixtures",
        "parameters": {
          "season": "2022",
          "team": "51"
        },
        "errors": [],
        "results": 52,
        "paging": {
          "current": 1,
          "total": 1
        },
        "response": [
          {
            "fixture": {
              "id": 867954,
              "referee": "P. Tierney",
              "timezone": "UTC",
              "date": "2022-08-07T13:00:00+00:00",
              "timestamp": 1659877200,
              "periods": {
                "first": 1659877200,
                "second": 1659880800
              },
              "venue": {
                "id": 556,
                "name": "Old Trafford",
                "city": "Manchester"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 1",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 33,
                "name": "Manchester United",
                "logo": "https://media.api-sports.io/football/teams/33.png",
                "winner": false
              },
              "away": {
                "id": 51,
                "name": "Brighton",
                "logo": "https://media.api-sports.io/football/teams/51.png",
                "winner": true
              }
            },
            "goals": {
              "home": 1,
              "away": 2
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 2
              },
              "fulltime": {
                "home": 1,
                "away": 2
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 867959,
              "referee": "G. Scott",
              "timezone": "UTC",
              "date": "2022-08-13T14:00:00+00:00",
              "timestamp": 1660399200,
              "periods": {
                "first": 1660399200,
                "second": 1660402800
              },
              "venue": {
                "id": 508,
                "name": "The American Express Community Stadium",
                "city": "Falmer, East Sussex"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 2",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 51,
                "name": "Brighton",
                "logo": "https://media.api-sports.io/football/teams/51.png",
                "winner": undefined
              },
              "away": {
                "id": 34,
                "name": "Newcastle",
                "logo": "https://media.api-sports.io/football/teams/34.png",
                "winner": undefined
              }
            },
            "goals": {
              "home": 0,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 0,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 867975,
              "referee": "A. Taylor",
              "timezone": "UTC",
              "date": "2022-08-21T13:00:00+00:00",
              "timestamp": 1661086800,
              "periods": {
                "first": 1661086800,
                "second": 1661090400
              },
              "venue": {
                "id": 598,
                "name": "London Stadium",
                "city": "London"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 3",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 48,
                "name": "West Ham",
                "logo": "https://media.api-sports.io/football/teams/48.png",
                "winner": false
              },
              "away": {
                "id": 51,
                "name": "Brighton",
                "logo": "https://media.api-sports.io/football/teams/51.png",
                "winner": true
              }
            },
            "goals": {
              "home": 0,
              "away": 2
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 1
              },
              "fulltime": {
                "home": 0,
                "away": 2
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 867979,
              "referee": "M. Salisbury",
              "timezone": "UTC",
              "date": "2022-08-27T14:00:00+00:00",
              "timestamp": 1661608800,
              "periods": {
                "first": 1661608800,
                "second": 1661612400
              },
              "venue": {
                "id": 508,
                "name": "The American Express Community Stadium",
                "city": "Falmer, East Sussex"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 4",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 51,
                "name": "Brighton",
                "logo": "https://media.api-sports.io/football/teams/51.png",
                "winner": true
              },
              "away": {
                "id": 63,
                "name": "Leeds",
                "logo": "https://media.api-sports.io/football/teams/63.png",
                "winner": false
              }
            },
            "goals": {
              "home": 1,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 1,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 867988,
              "referee": "T. Bramall",
              "timezone": "UTC",
              "date": "2022-08-30T18:30:00+00:00",
              "timestamp": 1661884200,
              "periods": {
                "first": 1661884200,
                "second": 1661887800
              },
              "venue": {
                "id": 535,
                "name": "Craven Cottage",
                "city": "London"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 5",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 36,
                "name": "Fulham",
                "logo": "https://media.api-sports.io/football/teams/36.png",
                "winner": true
              },
              "away": {
                "id": 51,
                "name": "Brighton",
                "logo": "https://media.api-sports.io/football/teams/51.png",
                "winner": false
              }
            },
            "goals": {
              "home": 2,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 2,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 867998,
              "referee": "T. Harrington",
              "timezone": "UTC",
              "date": "2022-09-04T13:00:00+00:00",
              "timestamp": 1662296400,
              "periods": {
                "first": 1662296400,
                "second": 1662300000
              },
              "venue": {
                "id": 508,
                "name": "The American Express Community Stadium",
                "city": "Falmer, East Sussex"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 6",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 51,
                "name": "Brighton",
                "logo": "https://media.api-sports.io/football/teams/51.png",
                "winner": true
              },
              "away": {
                "id": 46,
                "name": "Leicester",
                "logo": "https://media.api-sports.io/football/teams/46.png",
                "winner": false
              }
            },
            "goals": {
              "home": 5,
              "away": 2
            },
            "score": {
              "halftime": {
                "home": 2,
                "away": 2
              },
              "fulltime": {
                "home": 5,
                "away": 2
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 868006,
              "referee": "D. Bond",
              "timezone": "UTC",
              "date": "2023-04-04T18:45:00+00:00",
              "timestamp": 1680633900,
              "periods": {
                "first": 1680633900,
                "second": 1680637500
              },
              "venue": {
                "id": 504,
                "name": "Vitality Stadium",
                "city": "Bournemouth, Dorset"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 7",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 35,
                "name": "Bournemouth",
                "logo": "https://media.api-sports.io/football/teams/35.png",
                "winner": false
              },
              "away": {
                "id": 51,
                "name": "Brighton",
                "logo": "https://media.api-sports.io/football/teams/51.png",
                "winner": true
              }
            },
            "goals": {
              "home": 0,
              "away": 2
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 1
              },
              "fulltime": {
                "home": 0,
                "away": 2
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 868018,
              "referee": "P. Bankes",
              "timezone": "UTC",
              "date": "2023-03-15T19:30:00+00:00",
              "timestamp": 1678908600,
              "periods": {
                "first": 1678908600,
                "second": 1678912200
              },
              "venue": {
                "id": 508,
                "name": "The American Express Community Stadium",
                "city": "Falmer, East Sussex"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 8",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 51,
                "name": "Brighton",
                "logo": "https://media.api-sports.io/football/teams/51.png",
                "winner": true
              },
              "away": {
                "id": 52,
                "name": "Crystal Palace",
                "logo": "https://media.api-sports.io/football/teams/52.png",
                "winner": false
              }
            },
            "goals": {
              "home": 1,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 0
              },
              "fulltime": {
                "home": 1,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 868032,
              "referee": "A. Madley",
              "timezone": "UTC",
              "date": "2022-10-01T14:00:00+00:00",
              "timestamp": 1664632800,
              "periods": {
                "first": 1664632800,
                "second": 1664636400
              },
              "venue": {
                "id": 550,
                "name": "Anfield",
                "city": "Liverpool"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 9",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": undefined
              },
              "away": {
                "id": 51,
                "name": "Brighton",
                "logo": "https://media.api-sports.io/football/teams/51.png",
                "winner": undefined
              }
            },
            "goals": {
              "home": 3,
              "away": 3
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 2
              },
              "fulltime": {
                "home": 3,
                "away": 3
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 868038,
              "referee": "T. Harrington",
              "timezone": "UTC",
              "date": "2022-10-08T16:30:00+00:00",
              "timestamp": 1665246600,
              "periods": {
                "first": 1665246600,
                "second": 1665250200
              },
              "venue": {
                "id": 508,
                "name": "The American Express Community Stadium",
                "city": "Falmer, East Sussex"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 10",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 51,
                "name": "Brighton",
                "logo": "https://media.api-sports.io/football/teams/51.png",
                "winner": false
              },
              "away": {
                "id": 47,
                "name": "Tottenham",
                "logo": "https://media.api-sports.io/football/teams/47.png",
                "winner": true
              }
            },
            "goals": {
              "home": 0,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 1
              },
              "fulltime": {
                "home": 0,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 868047,
              "referee": "M. Salisbury",
              "timezone": "UTC",
              "date": "2022-10-14T19:00:00+00:00",
              "timestamp": 1665774000,
              "periods": {
                "first": 1665774000,
                "second": 1665777600
              },
              "venue": {
                "id": 10503,
                "name": "Gtech Community Stadium",
                "city": "Brentford, Middlesex"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 11",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 55,
                "name": "Brentford",
                "logo": "https://media.api-sports.io/football/teams/55.png",
                "winner": true
              },
              "away": {
                "id": 51,
                "name": "Brighton",
                "logo": "https://media.api-sports.io/football/teams/51.png",
                "winner": false
              }
            },
            "goals": {
              "home": 2,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 0
              },
              "fulltime": {
                "home": 2,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 868059,
              "referee": "D. England",
              "timezone": "UTC",
              "date": "2022-10-18T18:30:00+00:00",
              "timestamp": 1666117800,
              "periods": {
                "first": 1666117800,
                "second": 1666121400
              },
              "venue": {
                "id": 508,
                "name": "The American Express Community Stadium",
                "city": "Falmer, East Sussex"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 12",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 51,
                "name": "Brighton",
                "logo": "https://media.api-sports.io/football/teams/51.png",
                "winner": undefined
              },
              "away": {
                "id": 65,
                "name": "Nottingham Forest",
                "logo": "https://media.api-sports.io/football/teams/65.png",
                "winner": undefined
              }
            },
            "goals": {
              "home": 0,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 0,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 868070,
              "referee": "C. Pawson",
              "timezone": "UTC",
              "date": "2022-10-22T14:00:00+00:00",
              "timestamp": 1666447200,
              "periods": {
                "first": 1666447200,
                "second": 1666450800
              },
              "venue": {
                "id": 555,
                "name": "Etihad Stadium",
                "city": "Manchester"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 13",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 50,
                "name": "Manchester City",
                "logo": "https://media.api-sports.io/football/teams/50.png",
                "winner": true
              },
              "away": {
                "id": 51,
                "name": "Brighton",
                "logo": "https://media.api-sports.io/football/teams/51.png",
                "winner": false
              }
            },
            "goals": {
              "home": 3,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 2,
                "away": 0
              },
              "fulltime": {
                "home": 3,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 868079,
              "referee": "A. Madley",
              "timezone": "UTC",
              "date": "2022-10-29T14:00:00+00:00",
              "timestamp": 1667052000,
              "periods": {
                "first": 1667052000,
                "second": 1667055600
              },
              "venue": {
                "id": 508,
                "name": "The American Express Community Stadium",
                "city": "Falmer, East Sussex"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 14",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 51,
                "name": "Brighton",
                "logo": "https://media.api-sports.io/football/teams/51.png",
                "winner": true
              },
              "away": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": false
              }
            },
            "goals": {
              "home": 4,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 3,
                "away": 0
              },
              "fulltime": {
                "home": 4,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 868095,
              "referee": "G. Scott",
              "timezone": "UTC",
              "date": "2022-11-05T15:00:00+00:00",
              "timestamp": 1667660400,
              "periods": {
                "first": 1667660400,
                "second": 1667664000
              },
              "venue": {
                "id": 600,
                "name": "Molineux Stadium",
                "city": "Wolverhampton, West Midlands"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 15",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 39,
                "name": "Wolves",
                "logo": "https://media.api-sports.io/football/teams/39.png",
                "winner": false
              },
              "away": {
                "id": 51,
                "name": "Brighton",
                "logo": "https://media.api-sports.io/football/teams/51.png",
                "winner": true
              }
            },
            "goals": {
              "home": 2,
              "away": 3
            },
            "score": {
              "halftime": {
                "home": 2,
                "away": 2
              },
              "fulltime": {
                "home": 2,
                "away": 3
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 868097,
              "referee": "C. Kavanagh",
              "timezone": "UTC",
              "date": "2022-11-13T14:00:00+00:00",
              "timestamp": 1668348000,
              "periods": {
                "first": 1668348000,
                "second": 1668351600
              },
              "venue": {
                "id": 508,
                "name": "The American Express Community Stadium",
                "city": "Falmer, East Sussex"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 16",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 51,
                "name": "Brighton",
                "logo": "https://media.api-sports.io/football/teams/51.png",
                "winner": false
              },
              "away": {
                "id": 66,
                "name": "Aston Villa",
                "logo": "https://media.api-sports.io/football/teams/66.png",
                "winner": true
              }
            },
            "goals": {
              "home": 1,
              "away": 2
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 1
              },
              "fulltime": {
                "home": 1,
                "away": 2
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 868115,
              "referee": "R. Jones",
              "timezone": "UTC",
              "date": "2022-12-26T15:00:00+00:00",
              "timestamp": 1672066800,
              "periods": {
                "first": 1672066800,
                "second": 1672070400
              },
              "venue": {
                "id": 585,
                "name": "St. Mary's Stadium",
                "city": "Southampton, Hampshire"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 17",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 41,
                "name": "Southampton",
                "logo": "https://media.api-sports.io/football/teams/41.png",
                "winner": false
              },
              "away": {
                "id": 51,
                "name": "Brighton",
                "logo": "https://media.api-sports.io/football/teams/51.png",
                "winner": true
              }
            },
            "goals": {
              "home": 1,
              "away": 3
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 2
              },
              "fulltime": {
                "home": 1,
                "away": 3
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 868117,
              "referee": "A. Taylor",
              "timezone": "UTC",
              "date": "2022-12-31T17:30:00+00:00",
              "timestamp": 1672507800,
              "periods": {
                "first": 1672507800,
                "second": 1672511400
              },
              "venue": {
                "id": 508,
                "name": "The American Express Community Stadium",
                "city": "Falmer, East Sussex"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 18",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 51,
                "name": "Brighton",
                "logo": "https://media.api-sports.io/football/teams/51.png",
                "winner": false
              },
              "away": {
                "id": 42,
                "name": "Arsenal",
                "logo": "https://media.api-sports.io/football/teams/42.png",
                "winner": true
              }
            },
            "goals": {
              "home": 2,
              "away": 4
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 2
              },
              "fulltime": {
                "home": 2,
                "away": 4
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 868131,
              "referee": "A. Marriner",
              "timezone": "UTC",
              "date": "2023-01-03T19:45:00+00:00",
              "timestamp": 1672775100,
              "periods": {
                "first": 1672775100,
                "second": 1672778700
              },
              "venue": {
                "id": 8560,
                "name": "Goodison Park",
                "city": "Liverpool"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 19",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 45,
                "name": "Everton",
                "logo": "https://media.api-sports.io/football/teams/45.png",
                "winner": false
              },
              "away": {
                "id": 51,
                "name": "Brighton",
                "logo": "https://media.api-sports.io/football/teams/51.png",
                "winner": true
              }
            },
            "goals": {
              "home": 1,
              "away": 4
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 1
              },
              "fulltime": {
                "home": 1,
                "away": 4
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 868138,
              "referee": "D. England",
              "timezone": "UTC",
              "date": "2023-01-14T15:00:00+00:00",
              "timestamp": 1673708400,
              "periods": {
                "first": 1673708400,
                "second": 1673712000
              },
              "venue": {
                "id": 508,
                "name": "The American Express Community Stadium",
                "city": "Falmer, East Sussex"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 20",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 51,
                "name": "Brighton",
                "logo": "https://media.api-sports.io/football/teams/51.png",
                "winner": true
              },
              "away": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": false
              }
            },
            "goals": {
              "home": 3,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 3,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 868151,
              "referee": "T. Bramall",
              "timezone": "UTC",
              "date": "2023-01-21T15:00:00+00:00",
              "timestamp": 1674313200,
              "periods": {
                "first": 1674313200,
                "second": 1674316800
              },
              "venue": {
                "id": 547,
                "name": "King Power Stadium",
                "city": "Leicester, Leicestershire"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 21",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 46,
                "name": "Leicester",
                "logo": "https://media.api-sports.io/football/teams/46.png",
                "winner": undefined
              },
              "away": {
                "id": 51,
                "name": "Brighton",
                "logo": "https://media.api-sports.io/football/teams/51.png",
                "winner": undefined
              }
            },
            "goals": {
              "home": 2,
              "away": 2
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 1
              },
              "fulltime": {
                "home": 2,
                "away": 2
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 868158,
              "referee": "C. Pawson",
              "timezone": "UTC",
              "date": "2023-02-04T15:00:00+00:00",
              "timestamp": 1675522800,
              "periods": {
                "first": 1675522800,
                "second": 1675526400
              },
              "venue": {
                "id": 508,
                "name": "The American Express Community Stadium",
                "city": "Falmer, East Sussex"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 22",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 51,
                "name": "Brighton",
                "logo": "https://media.api-sports.io/football/teams/51.png",
                "winner": true
              },
              "away": {
                "id": 35,
                "name": "Bournemouth",
                "logo": "https://media.api-sports.io/football/teams/35.png",
                "winner": false
              }
            },
            "goals": {
              "home": 1,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 1,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 868168,
              "referee": "M. Oliver",
              "timezone": "UTC",
              "date": "2023-02-11T15:00:00+00:00",
              "timestamp": 1676127600,
              "periods": {
                "first": 1676127600,
                "second": 1676131200
              },
              "venue": {
                "id": 525,
                "name": "Selhurst Park",
                "city": "London"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 23",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 52,
                "name": "Crystal Palace",
                "logo": "https://media.api-sports.io/football/teams/52.png",
                "winner": undefined
              },
              "away": {
                "id": 51,
                "name": "Brighton",
                "logo": "https://media.api-sports.io/football/teams/51.png",
                "winner": undefined
              }
            },
            "goals": {
              "home": 1,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 1,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 868178,
              "referee": "D. England",
              "timezone": "UTC",
              "date": "2023-02-18T15:00:00+00:00",
              "timestamp": 1676732400,
              "periods": {
                "first": 1676732400,
                "second": 1676736000
              },
              "venue": {
                "id": 508,
                "name": "The American Express Community Stadium",
                "city": "Falmer, East Sussex"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 24",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 51,
                "name": "Brighton",
                "logo": "https://media.api-sports.io/football/teams/51.png",
                "winner": false
              },
              "away": {
                "id": 36,
                "name": "Fulham",
                "logo": "https://media.api-sports.io/football/teams/36.png",
                "winner": true
              }
            },
            "goals": {
              "home": 0,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 0,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 868193,
              "referee": "R. Jones",
              "timezone": "UTC",
              "date": "2023-05-18T18:30:00+00:00",
              "timestamp": 1684434600,
              "periods": {
                "first": 1684434600,
                "second": 1684438200
              },
              "venue": {
                "id": 562,
                "name": "St. James' Park",
                "city": "Newcastle upon Tyne"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 25",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 34,
                "name": "Newcastle",
                "logo": "https://media.api-sports.io/football/teams/34.png",
                "winner": true
              },
              "away": {
                "id": 51,
                "name": "Brighton",
                "logo": "https://media.api-sports.io/football/teams/51.png",
                "winner": false
              }
            },
            "goals": {
              "home": 4,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 2,
                "away": 0
              },
              "fulltime": {
                "home": 4,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 868199,
              "referee": "S. Attwell",
              "timezone": "UTC",
              "date": "2023-03-04T15:00:00+00:00",
              "timestamp": 1677942000,
              "periods": {
                "first": 1677942000,
                "second": 1677945600
              },
              "venue": {
                "id": 508,
                "name": "The American Express Community Stadium",
                "city": "Falmer, East Sussex"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 26",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 51,
                "name": "Brighton",
                "logo": "https://media.api-sports.io/football/teams/51.png",
                "winner": true
              },
              "away": {
                "id": 48,
                "name": "West Ham",
                "logo": "https://media.api-sports.io/football/teams/48.png",
                "winner": false
              }
            },
            "goals": {
              "home": 4,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 0
              },
              "fulltime": {
                "home": 4,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 868210,
              "referee": "P. Tierney",
              "timezone": "UTC",
              "date": "2023-03-11T15:00:00+00:00",
              "timestamp": 1678546800,
              "periods": {
                "first": 1678546800,
                "second": 1678550400
              },
              "venue": {
                "id": 546,
                "name": "Elland Road",
                "city": "Leeds, West Yorkshire"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 27",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 63,
                "name": "Leeds",
                "logo": "https://media.api-sports.io/football/teams/63.png",
                "winner": undefined
              },
              "away": {
                "id": 51,
                "name": "Brighton",
                "logo": "https://media.api-sports.io/football/teams/51.png",
                "winner": undefined
              }
            },
            "goals": {
              "home": 2,
              "away": 2
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 1
              },
              "fulltime": {
                "home": 2,
                "away": 2
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 868219,
              "referee": "A. Marriner",
              "timezone": "UTC",
              "date": "2023-05-04T19:00:00+00:00",
              "timestamp": 1683226800,
              "periods": {
                "first": 1683226800,
                "second": 1683230400
              },
              "venue": {
                "id": 508,
                "name": "The American Express Community Stadium",
                "city": "Falmer, East Sussex"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 28",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 51,
                "name": "Brighton",
                "logo": "https://media.api-sports.io/football/teams/51.png",
                "winner": true
              },
              "away": {
                "id": 33,
                "name": "Manchester United",
                "logo": "https://media.api-sports.io/football/teams/33.png",
                "winner": false
              }
            },
            "goals": {
              "home": 1,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 1,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 868228,
              "referee": "M. Oliver",
              "timezone": "UTC",
              "date": "2023-04-01T14:00:00+00:00",
              "timestamp": 1680357600,
              "periods": {
                "first": 1680357600,
                "second": 1680361200
              },
              "venue": {
                "id": 508,
                "name": "The American Express Community Stadium",
                "city": "Falmer, East Sussex"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 29",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 51,
                "name": "Brighton",
                "logo": "https://media.api-sports.io/football/teams/51.png",
                "winner": undefined
              },
              "away": {
                "id": 55,
                "name": "Brentford",
                "logo": "https://media.api-sports.io/football/teams/55.png",
                "winner": undefined
              }
            },
            "goals": {
              "home": 3,
              "away": 3
            },
            "score": {
              "halftime": {
                "home": 2,
                "away": 2
              },
              "fulltime": {
                "home": 3,
                "away": 3
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 868244,
              "referee": "S. Attwell",
              "timezone": "UTC",
              "date": "2023-04-08T14:00:00+00:00",
              "timestamp": 1680962400,
              "periods": {
                "first": 1680962400,
                "second": 1680966000
              },
              "venue": {
                "id": 593,
                "name": "Tottenham Hotspur Stadium",
                "city": "London"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 30",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 47,
                "name": "Tottenham",
                "logo": "https://media.api-sports.io/football/teams/47.png",
                "winner": true
              },
              "away": {
                "id": 51,
                "name": "Brighton",
                "logo": "https://media.api-sports.io/football/teams/51.png",
                "winner": false
              }
            },
            "goals": {
              "home": 2,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 1
              },
              "fulltime": {
                "home": 2,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 868247,
              "referee": "R. Jones",
              "timezone": "UTC",
              "date": "2023-04-15T14:00:00+00:00",
              "timestamp": 1681567200,
              "periods": {
                "first": 1681567200,
                "second": 1681570800
              },
              "venue": {
                "id": 519,
                "name": "Stamford Bridge",
                "city": "London"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 31",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 49,
                "name": "Chelsea",
                "logo": "https://media.api-sports.io/football/teams/49.png",
                "winner": false
              },
              "away": {
                "id": 51,
                "name": "Brighton",
                "logo": "https://media.api-sports.io/football/teams/51.png",
                "winner": true
              }
            },
            "goals": {
              "home": 1,
              "away": 2
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 1
              },
              "fulltime": {
                "home": 1,
                "away": 2
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 868259,
              "referee": "S. Hooper",
              "timezone": "UTC",
              "date": "2023-05-24T19:00:00+00:00",
              "timestamp": 1684954800,
              "periods": {
                "first": 1684954800,
                "second": 1684958400
              },
              "venue": {
                "id": 508,
                "name": "The American Express Community Stadium",
                "city": "Falmer, East Sussex"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 32",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 51,
                "name": "Brighton",
                "logo": "https://media.api-sports.io/football/teams/51.png",
                "winner": undefined
              },
              "away": {
                "id": 50,
                "name": "Manchester City",
                "logo": "https://media.api-sports.io/football/teams/50.png",
                "winner": undefined
              }
            },
            "goals": {
              "home": 1,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 1
              },
              "fulltime": {
                "home": 1,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 868268,
              "referee": "J. Gillett",
              "timezone": "UTC",
              "date": "2023-04-26T18:30:00+00:00",
              "timestamp": 1682533800,
              "periods": {
                "first": 1682533800,
                "second": 1682537400
              },
              "venue": {
                "id": 566,
                "name": "The City Ground",
                "city": "Nottingham, Nottinghamshire"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 33",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 65,
                "name": "Nottingham Forest",
                "logo": "https://media.api-sports.io/football/teams/65.png",
                "winner": true
              },
              "away": {
                "id": 51,
                "name": "Brighton",
                "logo": "https://media.api-sports.io/football/teams/51.png",
                "winner": false
              }
            },
            "goals": {
              "home": 3,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 1
              },
              "fulltime": {
                "home": 3,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 868279,
              "referee": "D. Coote",
              "timezone": "UTC",
              "date": "2023-04-29T14:00:00+00:00",
              "timestamp": 1682776800,
              "periods": {
                "first": 1682776800,
                "second": 1682780400
              },
              "venue": {
                "id": 508,
                "name": "The American Express Community Stadium",
                "city": "Falmer, East Sussex"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 34",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 51,
                "name": "Brighton",
                "logo": "https://media.api-sports.io/football/teams/51.png",
                "winner": true
              },
              "away": {
                "id": 39,
                "name": "Wolves",
                "logo": "https://media.api-sports.io/football/teams/39.png",
                "winner": false
              }
            },
            "goals": {
              "home": 6,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 4,
                "away": 0
              },
              "fulltime": {
                "home": 6,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 868287,
              "referee": "S. Hooper",
              "timezone": "UTC",
              "date": "2023-05-08T16:30:00+00:00",
              "timestamp": 1683563400,
              "periods": {
                "first": 1683563400,
                "second": 1683567000
              },
              "venue": {
                "id": 508,
                "name": "The American Express Community Stadium",
                "city": "Falmer, East Sussex"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 35",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 51,
                "name": "Brighton",
                "logo": "https://media.api-sports.io/football/teams/51.png",
                "winner": false
              },
              "away": {
                "id": 45,
                "name": "Everton",
                "logo": "https://media.api-sports.io/football/teams/45.png",
                "winner": true
              }
            },
            "goals": {
              "home": 1,
              "away": 5
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 3
              },
              "fulltime": {
                "home": 1,
                "away": 5
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 868296,
              "referee": "A. Madley",
              "timezone": "UTC",
              "date": "2023-05-14T15:30:00+00:00",
              "timestamp": 1684078200,
              "periods": {
                "first": 1684078200,
                "second": 1684081800
              },
              "venue": {
                "id": 494,
                "name": "Emirates Stadium",
                "city": "London"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 36",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 42,
                "name": "Arsenal",
                "logo": "https://media.api-sports.io/football/teams/42.png",
                "winner": false
              },
              "away": {
                "id": 51,
                "name": "Brighton",
                "logo": "https://media.api-sports.io/football/teams/51.png",
                "winner": true
              }
            },
            "goals": {
              "home": 0,
              "away": 3
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 0,
                "away": 3
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 868307,
              "referee": "P. Tierney",
              "timezone": "UTC",
              "date": "2023-05-21T13:00:00+00:00",
              "timestamp": 1684674000,
              "periods": {
                "first": 1684674000,
                "second": 1684677600
              },
              "venue": {
                "id": 508,
                "name": "The American Express Community Stadium",
                "city": "Falmer, East Sussex"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 37",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 51,
                "name": "Brighton",
                "logo": "https://media.api-sports.io/football/teams/51.png",
                "winner": true
              },
              "away": {
                "id": 41,
                "name": "Southampton",
                "logo": "https://media.api-sports.io/football/teams/41.png",
                "winner": false
              }
            },
            "goals": {
              "home": 3,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 2,
                "away": 0
              },
              "fulltime": {
                "home": 3,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 868317,
              "referee": "D. Coote",
              "timezone": "UTC",
              "date": "2023-05-28T15:30:00+00:00",
              "timestamp": 1685287800,
              "periods": {
                "first": 1685287800,
                "second": 1685291400
              },
              "venue": {
                "id": 495,
                "name": "Villa Park",
                "city": "Birmingham"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 39,
              "name": "Premier League",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/39.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Regular Season - 38",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 66,
                "name": "Aston Villa",
                "logo": "https://media.api-sports.io/football/teams/66.png",
                "winner": true
              },
              "away": {
                "id": 51,
                "name": "Brighton",
                "logo": "https://media.api-sports.io/football/teams/51.png",
                "winner": false
              }
            },
            "goals": {
              "home": 2,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 2,
                "away": 1
              },
              "fulltime": {
                "home": 2,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 870645,
              "referee": undefined,
              "timezone": "UTC",
              "date": "2022-07-09T17:00:00+00:00",
              "timestamp": 1657386000,
              "periods": {
                "first": 1657386000,
                "second": 1657389600
              },
              "venue": {
                "id": undefined,
                "name": "American Express Elite Football Performance Centre",
                "city": "Lancing, West Sussex"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 667,
              "name": "Friendlies Clubs",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/667.png",
              "flag": undefined,
              "season": 2022,
              "round": "Club Friendlies 3",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 51,
                "name": "Brighton",
                "logo": "https://media.api-sports.io/football/teams/51.png",
                "winner": undefined
              },
              "away": {
                "id": 1393,
                "name": "Union St. Gilloise",
                "logo": "https://media.api-sports.io/football/teams/1393.png",
                "winner": undefined
              }
            },
            "goals": {
              "home": 0,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 0,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 870968,
              "referee": undefined,
              "timezone": "UTC",
              "date": "2022-07-23T14:00:00+00:00",
              "timestamp": 1658584800,
              "periods": {
                "first": 1658584800,
                "second": 1658588400
              },
              "venue": {
                "id": 12052,
                "name": "Select Car Leasing Stadium",
                "city": "Reading, Berkshire"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 667,
              "name": "Friendlies Clubs",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/667.png",
              "flag": undefined,
              "season": 2022,
              "round": "Club Friendlies 3",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 53,
                "name": "Reading",
                "logo": "https://media.api-sports.io/football/teams/53.png",
                "winner": false
              },
              "away": {
                "id": 51,
                "name": "Brighton",
                "logo": "https://media.api-sports.io/football/teams/51.png",
                "winner": true
              }
            },
            "goals": {
              "home": 1,
              "away": 2
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 1
              },
              "fulltime": {
                "home": 1,
                "away": 2
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 870986,
              "referee": undefined,
              "timezone": "UTC",
              "date": "2022-07-26T14:00:00+00:00",
              "timestamp": 1658844000,
              "periods": {
                "first": 1658844000,
                "second": 1658847600
              },
              "venue": {
                "id": undefined,
                "name": "American Express Elite Football Performance Centre",
                "city": "Lancing, West Sussex"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 667,
              "name": "Friendlies Clubs",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/667.png",
              "flag": undefined,
              "season": 2022,
              "round": "Club Friendlies 3",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 51,
                "name": "Brighton",
                "logo": "https://media.api-sports.io/football/teams/51.png",
                "winner": false
              },
              "away": {
                "id": 55,
                "name": "Brentford",
                "logo": "https://media.api-sports.io/football/teams/55.png",
                "winner": true
              }
            },
            "goals": {
              "home": 0,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 0,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 890783,
              "referee": undefined,
              "timezone": "UTC",
              "date": "2022-07-16T17:30:00+00:00",
              "timestamp": 1657992600,
              "periods": {
                "first": 1657992600,
                "second": 1657996200
              },
              "venue": {
                "id": 3564,
                "name": "Estádio Pina Manique",
                "city": "Lisboa"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 667,
              "name": "Friendlies Clubs",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/667.png",
              "flag": undefined,
              "season": 2022,
              "round": "Club Friendlies 3",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 230,
                "name": "Estoril",
                "logo": "https://media.api-sports.io/football/teams/230.png",
                "winner": false
              },
              "away": {
                "id": 51,
                "name": "Brighton",
                "logo": "https://media.api-sports.io/football/teams/51.png",
                "winner": true
              }
            },
            "goals": {
              "home": 1,
              "away": 4
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 2
              },
              "fulltime": {
                "home": 1,
                "away": 4
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 891046,
              "referee": undefined,
              "timezone": "UTC",
              "date": "2022-07-30T14:00:00+00:00",
              "timestamp": 1659189600,
              "periods": {
                "first": 1659189600,
                "second": 1659193200
              },
              "venue": {
                "id": 508,
                "name": "The American Express Community Stadium",
                "city": "Falmer, East Sussex"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 667,
              "name": "Friendlies Clubs",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/667.png",
              "flag": undefined,
              "season": 2022,
              "round": "Club Friendlies 3",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 51,
                "name": "Brighton",
                "logo": "https://media.api-sports.io/football/teams/51.png",
                "winner": true
              },
              "away": {
                "id": 540,
                "name": "Espanyol",
                "logo": "https://media.api-sports.io/football/teams/540.png",
                "winner": false
              }
            },
            "goals": {
              "home": 5,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 0
              },
              "fulltime": {
                "home": 5,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 933642,
              "referee": "T. Robinson",
              "timezone": "UTC",
              "date": "2022-08-24T18:45:00+00:00",
              "timestamp": 1661366700,
              "periods": {
                "first": 1661366700,
                "second": 1661370300
              },
              "venue": {
                "id": 19201,
                "name": "The Bolt New Lawn",
                "city": "Nailsworth, Gloucestershire"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 48,
              "name": "League Cup",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/48.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "2nd Round",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 1378,
                "name": "Forest Green",
                "logo": "https://media.api-sports.io/football/teams/1378.png",
                "winner": false
              },
              "away": {
                "id": 51,
                "name": "Brighton",
                "logo": "https://media.api-sports.io/football/teams/51.png",
                "winner": true
              }
            },
            "goals": {
              "home": 0,
              "away": 3
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 2
              },
              "fulltime": {
                "home": 0,
                "away": 3
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 945944,
              "referee": "J. Gillett",
              "timezone": "UTC",
              "date": "2022-11-09T19:45:00+00:00",
              "timestamp": 1668023100,
              "periods": {
                "first": 1668023100,
                "second": 1668026700
              },
              "venue": {
                "id": 494,
                "name": "Emirates Stadium",
                "city": "London"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 48,
              "name": "League Cup",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/48.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "3rd Round",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 42,
                "name": "Arsenal",
                "logo": "https://media.api-sports.io/football/teams/42.png",
                "winner": false
              },
              "away": {
                "id": 51,
                "name": "Brighton",
                "logo": "https://media.api-sports.io/football/teams/51.png",
                "winner": true
              }
            },
            "goals": {
              "home": 1,
              "away": 3
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 1
              },
              "fulltime": {
                "home": 1,
                "away": 3
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 972365,
              "referee": "T. Bramall",
              "timezone": "UTC",
              "date": "2022-12-21T19:45:00+00:00",
              "timestamp": 1671651900,
              "periods": {
                "first": 1671651900,
                "second": 1671655500
              },
              "venue": {
                "id": 518,
                "name": "The Valley",
                "city": "London"
              },
              "status": {
                "long": "Match Finished",
                "short": "PEN",
                "elapsed": 120,
                "extra": undefined
              }
            },
            "league": {
              "id": 48,
              "name": "League Cup",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/48.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Round of 16",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 1335,
                "name": "Charlton",
                "logo": "https://media.api-sports.io/football/teams/1335.png",
                "winner": true
              },
              "away": {
                "id": 51,
                "name": "Brighton",
                "logo": "https://media.api-sports.io/football/teams/51.png",
                "winner": false
              }
            },
            "goals": {
              "home": 0,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 0,
                "away": 0
              },
              "extratime": {
                "home": 0,
                "away": 0
              },
              "penalty": {
                "home": 4,
                "away": 3
              }
            }
          },
          {
            "fixture": {
              "id": 976462,
              "referee": "S. Hooper",
              "timezone": "UTC",
              "date": "2023-01-07T15:00:00+00:00",
              "timestamp": 1673103600,
              "periods": {
                "first": 1673103600,
                "second": 1673107200
              },
              "venue": {
                "id": 558,
                "name": "Riverside Stadium",
                "city": "Middlesbrough"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 45,
              "name": "FA Cup",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/45.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "3rd Round",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 70,
                "name": "Middlesbrough",
                "logo": "https://media.api-sports.io/football/teams/70.png",
                "winner": false
              },
              "away": {
                "id": 51,
                "name": "Brighton",
                "logo": "https://media.api-sports.io/football/teams/51.png",
                "winner": true
              }
            },
            "goals": {
              "home": 1,
              "away": 5
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 2
              },
              "fulltime": {
                "home": 1,
                "away": 5
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 979542,
              "referee": undefined,
              "timezone": "UTC",
              "date": "2022-12-08T13:00:00+00:00",
              "timestamp": 1670504400,
              "periods": {
                "first": 1670504400,
                "second": 1670508000
              },
              "venue": {
                "id": undefined,
                "name": "Jebel Ali Centre of Excellence",
                "city": "Dubai"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 667,
              "name": "Friendlies Clubs",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/667.png",
              "flag": undefined,
              "season": 2022,
              "round": "Club Friendlies 3",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 66,
                "name": "Aston Villa",
                "logo": "https://media.api-sports.io/football/teams/66.png",
                "winner": undefined
              },
              "away": {
                "id": 51,
                "name": "Brighton",
                "logo": "https://media.api-sports.io/football/teams/51.png",
                "winner": undefined
              }
            },
            "goals": {
              "home": 2,
              "away": 2
            },
            "score": {
              "halftime": {
                "home": undefined,
                "away": undefined
              },
              "fulltime": {
                "home": 2,
                "away": 2
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 990835,
              "referee": "D. Coote",
              "timezone": "UTC",
              "date": "2023-01-29T13:30:00+00:00",
              "timestamp": 1674999000,
              "periods": {
                "first": 1674999000,
                "second": 1675002600
              },
              "venue": {
                "id": 508,
                "name": "The American Express Community Stadium",
                "city": "Falmer, East Sussex"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 45,
              "name": "FA Cup",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/45.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "4th Round",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 51,
                "name": "Brighton",
                "logo": "https://media.api-sports.io/football/teams/51.png",
                "winner": true
              },
              "away": {
                "id": 40,
                "name": "Liverpool",
                "logo": "https://media.api-sports.io/football/teams/40.png",
                "winner": false
              }
            },
            "goals": {
              "home": 2,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 1
              },
              "fulltime": {
                "home": 2,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 997624,
              "referee": "D. Bond",
              "timezone": "UTC",
              "date": "2023-02-28T19:15:00+00:00",
              "timestamp": 1677611700,
              "periods": {
                "first": 1677611700,
                "second": 1677615300
              },
              "venue": {
                "id": 588,
                "name": "bet365 Stadium",
                "city": "Stoke-on-Trent, Staffordshire"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 45,
              "name": "FA Cup",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/45.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "5th Round",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 75,
                "name": "Stoke City",
                "logo": "https://media.api-sports.io/football/teams/75.png",
                "winner": false
              },
              "away": {
                "id": 51,
                "name": "Brighton",
                "logo": "https://media.api-sports.io/football/teams/51.png",
                "winner": true
              }
            },
            "goals": {
              "home": 0,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 1
              },
              "fulltime": {
                "home": 0,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 1011480,
              "referee": "J. Gillett",
              "timezone": "UTC",
              "date": "2023-03-19T14:15:00+00:00",
              "timestamp": 1679235300,
              "periods": {
                "first": 1679235300,
                "second": 1679238900
              },
              "venue": {
                "id": 508,
                "name": "The American Express Community Stadium",
                "city": "Falmer, East Sussex"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 45,
              "name": "FA Cup",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/45.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Quarter-finals",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 51,
                "name": "Brighton",
                "logo": "https://media.api-sports.io/football/teams/51.png",
                "winner": true
              },
              "away": {
                "id": 1365,
                "name": "Grimsby",
                "logo": "https://media.api-sports.io/football/teams/1365.png",
                "winner": false
              }
            },
            "goals": {
              "home": 5,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 0
              },
              "fulltime": {
                "home": 5,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 1017111,
              "referee": "C. Pawson",
              "timezone": "UTC",
              "date": "2023-04-23T15:30:00+00:00",
              "timestamp": 1682263800,
              "periods": {
                "first": 1682263800,
                "second": 1682267400
              },
              "venue": {
                "id": 489,
                "name": "Wembley Stadium",
                "city": "London"
              },
              "status": {
                "long": "Match Finished",
                "short": "PEN",
                "elapsed": 120,
                "extra": undefined
              }
            },
            "league": {
              "id": 45,
              "name": "FA Cup",
              "country": "England",
              "logo": "https://media.api-sports.io/football/leagues/45.png",
              "flag": "https://media.api-sports.io/flags/gb-eng.svg",
              "season": 2022,
              "round": "Semi-finals",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 51,
                "name": "Brighton",
                "logo": "https://media.api-sports.io/football/teams/51.png",
                "winner": false
              },
              "away": {
                "id": 33,
                "name": "Manchester United",
                "logo": "https://media.api-sports.io/football/teams/33.png",
                "winner": true
              }
            },
            "goals": {
              "home": 0,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 0,
                "away": 0
              },
              "extratime": {
                "home": 0,
                "away": 0
              },
              "penalty": {
                "home": 6,
                "away": 7
              }
            }
          }
        ]
      },
      "headers": {
        "date": "Sun, 23 Nov 2025 11:10:22 GMT",
        "content-type": "application/json",
        "transfer-encoding": "chunked",
        "connection": "keep-alive",
        "server": "cloudflare",
        "vary": "Accept-Encoding",
        "access-control-allow-origin": "*",
        "access-control-allow-credentials": "True",
        "access-control-allow-methods": "GET, OPTIONS",
        "access-control-allow-headers": "x-rapidapi-key, x-apisports-key, x-rapidapi-host",
        "x-ratelimit-limit": "10",
        "x-ratelimit-remaining": "9",
        "x-ratelimit-requests-limit": "100",
        "x-ratelimit-requests-remaining": "85",
        "x-ttl": "14400",
        "x-envoy-upstream-service-time": "18",
        "cache-control": "no-store, no-cache, must-revalidate",
        "pragma": "no-cache",
        "expires": "0",
        "strict-transport-security": "max-age=31536000; includeSubDomains",
        "cf-cache-status": "DYNAMIC",
        "nel": "{\"report_to\":\"cf-nel\",\"success_fraction\":0.0,\"max_age\":604800}",
        "report-to": "{\"group\":\"cf-nel\",\"max_age\":604800,\"endpoints\":[{\"url\":\"https://a.nel.cloudflare.com/report/v4?s=q30iRTRtpHYUufJEDtjaeMvcAoq8PaER7A3yCwhlTUMNsx84%2B0JViTLe9y3gm%2BR6HAO2ujkrwb7w5W2oOMEh0OIJ1Fvi%2FX5bUO0LrNewTV%2F6Fg8B5eigVA%3D%3D\"}]}",
        "cf-ray": "9a30383dfb5624b1-ARN"
      }
    }
  },
  {
    "request": {
      "method": "GET",
      "url": "https://v3.football.api-sports.io/fixtures",
      "headers": {
        "x-rapidapi-key": "52dd...5e7f",
        "x-rapidapi-host": "api-football-v1.p.rapidapi.com"
      },
      "queryParams": {
        "season": "2022",
        "team": "548"
      }
    },
    "response": {
      "status": 200,
      "data": {
        "get": "fixtures",
        "parameters": {
          "season": "2022",
          "team": "548"
        },
        "errors": [],
        "results": 60,
        "paging": {
          "current": 1,
          "total": 1
        },
        "response": [
          {
            "fixture": {
              "id": 870932,
              "referee": undefined,
              "timezone": "UTC",
              "date": "2022-07-23T13:30:00+00:00",
              "timestamp": 1658583000,
              "periods": {
                "first": 1658583000,
                "second": 1658586600
              },
              "venue": {
                "id": 703,
                "name": "Stadion im BORUSSIA-PARK",
                "city": "Mönchengladbach"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 667,
              "name": "Friendlies Clubs",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/667.png",
              "flag": undefined,
              "season": 2022,
              "round": "Club Friendlies 3",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 163,
                "name": "Borussia Monchengladbach",
                "logo": "https://media.api-sports.io/football/teams/163.png",
                "winner": undefined
              },
              "away": {
                "id": 548,
                "name": "Real Sociedad",
                "logo": "https://media.api-sports.io/football/teams/548.png",
                "winner": undefined
              }
            },
            "goals": {
              "home": 1,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 0
              },
              "fulltime": {
                "home": 1,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 871033,
              "referee": undefined,
              "timezone": "UTC",
              "date": "2022-07-30T14:00:00+00:00",
              "timestamp": 1659189600,
              "periods": {
                "first": 1659189600,
                "second": 1659193200
              },
              "venue": {
                "id": 504,
                "name": "Vitality Stadium",
                "city": "Bournemouth, Dorset"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 667,
              "name": "Friendlies Clubs",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/667.png",
              "flag": undefined,
              "season": 2022,
              "round": "Club Friendlies 3",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 35,
                "name": "Bournemouth",
                "logo": "https://media.api-sports.io/football/teams/35.png",
                "winner": false
              },
              "away": {
                "id": 548,
                "name": "Real Sociedad",
                "logo": "https://media.api-sports.io/football/teams/548.png",
                "winner": true
              }
            },
            "goals": {
              "home": 1,
              "away": 2
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 1
              },
              "fulltime": {
                "home": 1,
                "away": 2
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 877946,
              "referee": "Isidro Díaz de Mera",
              "timezone": "UTC",
              "date": "2022-08-14T15:30:00+00:00",
              "timestamp": 1660491000,
              "periods": {
                "first": 1660491000,
                "second": 1660494600
              },
              "venue": {
                "id": 11915,
                "name": "Estadio Nuevo Mirandilla",
                "city": "Cádiz"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 140,
              "name": "La Liga",
              "country": "Spain",
              "logo": "https://media.api-sports.io/football/leagues/140.png",
              "flag": "https://media.api-sports.io/flags/es.svg",
              "season": 2022,
              "round": "Regular Season - 1",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 724,
                "name": "Cadiz",
                "logo": "https://media.api-sports.io/football/teams/724.png",
                "winner": false
              },
              "away": {
                "id": 548,
                "name": "Real Sociedad",
                "logo": "https://media.api-sports.io/football/teams/548.png",
                "winner": true
              }
            },
            "goals": {
              "home": 0,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 1
              },
              "fulltime": {
                "home": 0,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 877957,
              "referee": "José Munuera",
              "timezone": "UTC",
              "date": "2022-08-21T20:00:00+00:00",
              "timestamp": 1661112000,
              "periods": {
                "first": 1661112000,
                "second": 1661115600
              },
              "venue": {
                "id": 1491,
                "name": "Reale Arena",
                "city": "Donostia-San Sebastián"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 140,
              "name": "La Liga",
              "country": "Spain",
              "logo": "https://media.api-sports.io/football/leagues/140.png",
              "flag": "https://media.api-sports.io/flags/es.svg",
              "season": 2022,
              "round": "Regular Season - 2",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 548,
                "name": "Real Sociedad",
                "logo": "https://media.api-sports.io/football/teams/548.png",
                "winner": false
              },
              "away": {
                "id": 529,
                "name": "Barcelona",
                "logo": "https://media.api-sports.io/football/teams/529.png",
                "winner": true
              }
            },
            "goals": {
              "home": 1,
              "away": 4
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 1
              },
              "fulltime": {
                "home": 1,
                "away": 4
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 877964,
              "referee": "Javier Iglesias",
              "timezone": "UTC",
              "date": "2022-08-27T15:30:00+00:00",
              "timestamp": 1661614200,
              "periods": {
                "first": 1661614200,
                "second": 1661617800
              },
              "venue": {
                "id": 1473,
                "name": "Estadio Manuel Martínez Valero",
                "city": "Elche"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 140,
              "name": "La Liga",
              "country": "Spain",
              "logo": "https://media.api-sports.io/football/leagues/140.png",
              "flag": "https://media.api-sports.io/flags/es.svg",
              "season": 2022,
              "round": "Regular Season - 3",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 797,
                "name": "Elche",
                "logo": "https://media.api-sports.io/football/teams/797.png",
                "winner": false
              },
              "away": {
                "id": 548,
                "name": "Real Sociedad",
                "logo": "https://media.api-sports.io/football/teams/548.png",
                "winner": true
              }
            },
            "goals": {
              "home": 0,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 1
              },
              "fulltime": {
                "home": 0,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 877974,
              "referee": "César Soto",
              "timezone": "UTC",
              "date": "2022-09-03T16:30:00+00:00",
              "timestamp": 1662222600,
              "periods": {
                "first": 1662222600,
                "second": 1662226200
              },
              "venue": {
                "id": 1491,
                "name": "Reale Arena",
                "city": "Donostia-San Sebastián"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 140,
              "name": "La Liga",
              "country": "Spain",
              "logo": "https://media.api-sports.io/football/leagues/140.png",
              "flag": "https://media.api-sports.io/flags/es.svg",
              "season": 2022,
              "round": "Regular Season - 4",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 548,
                "name": "Real Sociedad",
                "logo": "https://media.api-sports.io/football/teams/548.png",
                "winner": undefined
              },
              "away": {
                "id": 530,
                "name": "Atletico Madrid",
                "logo": "https://media.api-sports.io/football/teams/530.png",
                "winner": undefined
              }
            },
            "goals": {
              "home": 1,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 1
              },
              "fulltime": {
                "home": 1,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 877984,
              "referee": "Juan Pulido",
              "timezone": "UTC",
              "date": "2022-09-11T16:30:00+00:00",
              "timestamp": 1662913800,
              "periods": {
                "first": 1662913800,
                "second": 1662917400
              },
              "venue": {
                "id": 1476,
                "name": "Coliseum Alfonso Pérez",
                "city": "Getafe"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 140,
              "name": "La Liga",
              "country": "Spain",
              "logo": "https://media.api-sports.io/football/leagues/140.png",
              "flag": "https://media.api-sports.io/flags/es.svg",
              "season": 2022,
              "round": "Regular Season - 5",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 546,
                "name": "Getafe",
                "logo": "https://media.api-sports.io/football/teams/546.png",
                "winner": true
              },
              "away": {
                "id": 548,
                "name": "Real Sociedad",
                "logo": "https://media.api-sports.io/football/teams/548.png",
                "winner": false
              }
            },
            "goals": {
              "home": 2,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 0
              },
              "fulltime": {
                "home": 2,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 877999,
              "referee": "Carlos del Cerro",
              "timezone": "UTC",
              "date": "2022-09-18T16:30:00+00:00",
              "timestamp": 1663518600,
              "periods": {
                "first": 1663518600,
                "second": 1663522200
              },
              "venue": {
                "id": 1491,
                "name": "Reale Arena",
                "city": "Donostia-San Sebastián"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 140,
              "name": "La Liga",
              "country": "Spain",
              "logo": "https://media.api-sports.io/football/leagues/140.png",
              "flag": "https://media.api-sports.io/flags/es.svg",
              "season": 2022,
              "round": "Regular Season - 6",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 548,
                "name": "Real Sociedad",
                "logo": "https://media.api-sports.io/football/teams/548.png",
                "winner": true
              },
              "away": {
                "id": 540,
                "name": "Espanyol",
                "logo": "https://media.api-sports.io/football/teams/540.png",
                "winner": false
              }
            },
            "goals": {
              "home": 2,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 2,
                "away": 1
              },
              "fulltime": {
                "home": 2,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 878005,
              "referee": "Mario Melero",
              "timezone": "UTC",
              "date": "2022-10-02T16:30:00+00:00",
              "timestamp": 1664728200,
              "periods": {
                "first": 1664728200,
                "second": 1664731800
              },
              "venue": {
                "id": 1478,
                "name": "Estadi Municipal de Montilivi",
                "city": "Girona"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 140,
              "name": "La Liga",
              "country": "Spain",
              "logo": "https://media.api-sports.io/football/leagues/140.png",
              "flag": "https://media.api-sports.io/flags/es.svg",
              "season": 2022,
              "round": "Regular Season - 7",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 547,
                "name": "Girona",
                "logo": "https://media.api-sports.io/football/teams/547.png",
                "winner": false
              },
              "away": {
                "id": 548,
                "name": "Real Sociedad",
                "logo": "https://media.api-sports.io/football/teams/548.png",
                "winner": true
              }
            },
            "goals": {
              "home": 3,
              "away": 5
            },
            "score": {
              "halftime": {
                "home": 2,
                "away": 2
              },
              "fulltime": {
                "home": 3,
                "away": 5
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 878018,
              "referee": "César Soto",
              "timezone": "UTC",
              "date": "2022-10-09T16:30:00+00:00",
              "timestamp": 1665333000,
              "periods": {
                "first": 1665333000,
                "second": 1665336600
              },
              "venue": {
                "id": 1491,
                "name": "Reale Arena",
                "city": "Donostia-San Sebastián"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 140,
              "name": "La Liga",
              "country": "Spain",
              "logo": "https://media.api-sports.io/football/leagues/140.png",
              "flag": "https://media.api-sports.io/flags/es.svg",
              "season": 2022,
              "round": "Regular Season - 8",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 548,
                "name": "Real Sociedad",
                "logo": "https://media.api-sports.io/football/teams/548.png",
                "winner": true
              },
              "away": {
                "id": 533,
                "name": "Villarreal",
                "logo": "https://media.api-sports.io/football/teams/533.png",
                "winner": false
              }
            },
            "goals": {
              "home": 1,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 0
              },
              "fulltime": {
                "home": 1,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 878023,
              "referee": "Guillermo Cuadra",
              "timezone": "UTC",
              "date": "2022-10-16T12:00:00+00:00",
              "timestamp": 1665921600,
              "periods": {
                "first": 1665921600,
                "second": 1665925200
              },
              "venue": {
                "id": 1467,
                "name": "Abanca-Balaídos",
                "city": "Vigo"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 140,
              "name": "La Liga",
              "country": "Spain",
              "logo": "https://media.api-sports.io/football/leagues/140.png",
              "flag": "https://media.api-sports.io/flags/es.svg",
              "season": 2022,
              "round": "Regular Season - 9",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 538,
                "name": "Celta Vigo",
                "logo": "https://media.api-sports.io/football/teams/538.png",
                "winner": false
              },
              "away": {
                "id": 548,
                "name": "Real Sociedad",
                "logo": "https://media.api-sports.io/football/teams/548.png",
                "winner": true
              }
            },
            "goals": {
              "home": 1,
              "away": 2
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 1
              },
              "fulltime": {
                "home": 1,
                "away": 2
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 878040,
              "referee": "Miguel Ortiz",
              "timezone": "UTC",
              "date": "2022-10-19T18:00:00+00:00",
              "timestamp": 1666202400,
              "periods": {
                "first": 1666202400,
                "second": 1666206000
              },
              "venue": {
                "id": 1491,
                "name": "Reale Arena",
                "city": "Donostia-San Sebastián"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 140,
              "name": "La Liga",
              "country": "Spain",
              "logo": "https://media.api-sports.io/football/leagues/140.png",
              "flag": "https://media.api-sports.io/flags/es.svg",
              "season": 2022,
              "round": "Regular Season - 10",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 548,
                "name": "Real Sociedad",
                "logo": "https://media.api-sports.io/football/teams/548.png",
                "winner": true
              },
              "away": {
                "id": 798,
                "name": "Mallorca",
                "logo": "https://media.api-sports.io/football/teams/798.png",
                "winner": false
              }
            },
            "goals": {
              "home": 1,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 0
              },
              "fulltime": {
                "home": 1,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 878050,
              "referee": "Jorge Figueroa",
              "timezone": "UTC",
              "date": "2022-10-22T14:15:00+00:00",
              "timestamp": 1666448100,
              "periods": {
                "first": 1666448100,
                "second": 1666451700
              },
              "venue": {
                "id": 1492,
                "name": "Estadio Municipal José Zorrilla",
                "city": "Valladolid"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 140,
              "name": "La Liga",
              "country": "Spain",
              "logo": "https://media.api-sports.io/football/leagues/140.png",
              "flag": "https://media.api-sports.io/flags/es.svg",
              "season": 2022,
              "round": "Regular Season - 11",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 720,
                "name": "Valladolid",
                "logo": "https://media.api-sports.io/football/teams/720.png",
                "winner": true
              },
              "away": {
                "id": 548,
                "name": "Real Sociedad",
                "logo": "https://media.api-sports.io/football/teams/548.png",
                "winner": false
              }
            },
            "goals": {
              "home": 1,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 0
              },
              "fulltime": {
                "home": 1,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 878058,
              "referee": "Javier Iglesias",
              "timezone": "UTC",
              "date": "2022-10-30T20:00:00+00:00",
              "timestamp": 1667160000,
              "periods": {
                "first": 1667160000,
                "second": 1667163600
              },
              "venue": {
                "id": 1491,
                "name": "Reale Arena",
                "city": "Donostia-San Sebastián"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 140,
              "name": "La Liga",
              "country": "Spain",
              "logo": "https://media.api-sports.io/football/leagues/140.png",
              "flag": "https://media.api-sports.io/flags/es.svg",
              "season": 2022,
              "round": "Regular Season - 12",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 548,
                "name": "Real Sociedad",
                "logo": "https://media.api-sports.io/football/teams/548.png",
                "winner": false
              },
              "away": {
                "id": 543,
                "name": "Real Betis",
                "logo": "https://media.api-sports.io/football/teams/543.png",
                "winner": true
              }
            },
            "goals": {
              "home": 0,
              "away": 2
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 0,
                "away": 2
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 878065,
              "referee": "José Munuera",
              "timezone": "UTC",
              "date": "2022-11-06T15:15:00+00:00",
              "timestamp": 1667747700,
              "periods": {
                "first": 1667747700,
                "second": 1667751300
              },
              "venue": {
                "id": 1491,
                "name": "Reale Arena",
                "city": "Donostia-San Sebastián"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 140,
              "name": "La Liga",
              "country": "Spain",
              "logo": "https://media.api-sports.io/football/leagues/140.png",
              "flag": "https://media.api-sports.io/flags/es.svg",
              "season": 2022,
              "round": "Regular Season - 13",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 548,
                "name": "Real Sociedad",
                "logo": "https://media.api-sports.io/football/teams/548.png",
                "winner": undefined
              },
              "away": {
                "id": 532,
                "name": "Valencia",
                "logo": "https://media.api-sports.io/football/teams/532.png",
                "winner": undefined
              }
            },
            "goals": {
              "home": 1,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 1
              },
              "fulltime": {
                "home": 1,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 878081,
              "referee": "Carlos del Cerro",
              "timezone": "UTC",
              "date": "2022-11-09T18:00:00+00:00",
              "timestamp": 1668016800,
              "periods": {
                "first": 1668016800,
                "second": 1668020400
              },
              "venue": {
                "id": 1494,
                "name": "Estadio Ramón Sánchez Pizjuán",
                "city": "Sevilla"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 140,
              "name": "La Liga",
              "country": "Spain",
              "logo": "https://media.api-sports.io/football/leagues/140.png",
              "flag": "https://media.api-sports.io/flags/es.svg",
              "season": 2022,
              "round": "Regular Season - 14",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 536,
                "name": "Sevilla",
                "logo": "https://media.api-sports.io/football/teams/536.png",
                "winner": false
              },
              "away": {
                "id": 548,
                "name": "Real Sociedad",
                "logo": "https://media.api-sports.io/football/teams/548.png",
                "winner": true
              }
            },
            "goals": {
              "home": 1,
              "away": 2
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 2
              },
              "fulltime": {
                "home": 1,
                "away": 2
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 878088,
              "referee": "Valentín Pizarro",
              "timezone": "UTC",
              "date": "2022-12-31T15:15:00+00:00",
              "timestamp": 1672499700,
              "periods": {
                "first": 1672499700,
                "second": 1672503300
              },
              "venue": {
                "id": 1491,
                "name": "Reale Arena",
                "city": "Donostia-San Sebastián"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 140,
              "name": "La Liga",
              "country": "Spain",
              "logo": "https://media.api-sports.io/football/leagues/140.png",
              "flag": "https://media.api-sports.io/flags/es.svg",
              "season": 2022,
              "round": "Regular Season - 15",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 548,
                "name": "Real Sociedad",
                "logo": "https://media.api-sports.io/football/teams/548.png",
                "winner": true
              },
              "away": {
                "id": 727,
                "name": "Osasuna",
                "logo": "https://media.api-sports.io/football/teams/727.png",
                "winner": false
              }
            },
            "goals": {
              "home": 2,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 0
              },
              "fulltime": {
                "home": 2,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 878096,
              "referee": "Javier Alberola",
              "timezone": "UTC",
              "date": "2023-01-08T13:00:00+00:00",
              "timestamp": 1673182800,
              "periods": {
                "first": 1673182800,
                "second": 1673186400
              },
              "venue": {
                "id": 19216,
                "name": "Power Horse Stadium – Estadio de los Juegos Mediterráneos",
                "city": "Almería"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 140,
              "name": "La Liga",
              "country": "Spain",
              "logo": "https://media.api-sports.io/football/leagues/140.png",
              "flag": "https://media.api-sports.io/flags/es.svg",
              "season": 2022,
              "round": "Regular Season - 16",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 723,
                "name": "Almeria",
                "logo": "https://media.api-sports.io/football/teams/723.png",
                "winner": false
              },
              "away": {
                "id": 548,
                "name": "Real Sociedad",
                "logo": "https://media.api-sports.io/football/teams/548.png",
                "winner": true
              }
            },
            "goals": {
              "home": 0,
              "away": 2
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 0,
                "away": 2
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 878107,
              "referee": "Guillermo Cuadra",
              "timezone": "UTC",
              "date": "2023-01-14T20:00:00+00:00",
              "timestamp": 1673726400,
              "periods": {
                "first": 1673726400,
                "second": 1673730000
              },
              "venue": {
                "id": 1491,
                "name": "Reale Arena",
                "city": "Donostia-San Sebastián"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 140,
              "name": "La Liga",
              "country": "Spain",
              "logo": "https://media.api-sports.io/football/leagues/140.png",
              "flag": "https://media.api-sports.io/flags/es.svg",
              "season": 2022,
              "round": "Regular Season - 17",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 548,
                "name": "Real Sociedad",
                "logo": "https://media.api-sports.io/football/teams/548.png",
                "winner": true
              },
              "away": {
                "id": 531,
                "name": "Athletic Club",
                "logo": "https://media.api-sports.io/football/teams/531.png",
                "winner": false
              }
            },
            "goals": {
              "home": 3,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 2,
                "away": 1
              },
              "fulltime": {
                "home": 3,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 878116,
              "referee": "Antonio Mateu",
              "timezone": "UTC",
              "date": "2023-01-21T13:00:00+00:00",
              "timestamp": 1674306000,
              "periods": {
                "first": 1674306000,
                "second": 1674309600
              },
              "venue": {
                "id": 1488,
                "name": "Estadio de Vallecas",
                "city": "Madrid"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 140,
              "name": "La Liga",
              "country": "Spain",
              "logo": "https://media.api-sports.io/football/leagues/140.png",
              "flag": "https://media.api-sports.io/flags/es.svg",
              "season": 2022,
              "round": "Regular Season - 18",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 728,
                "name": "Rayo Vallecano",
                "logo": "https://media.api-sports.io/football/teams/728.png",
                "winner": false
              },
              "away": {
                "id": 548,
                "name": "Real Sociedad",
                "logo": "https://media.api-sports.io/football/teams/548.png",
                "winner": true
              }
            },
            "goals": {
              "home": 0,
              "away": 2
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 2
              },
              "fulltime": {
                "home": 0,
                "away": 2
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 878123,
              "referee": "Mario Melero",
              "timezone": "UTC",
              "date": "2023-01-29T20:00:00+00:00",
              "timestamp": 1675022400,
              "periods": {
                "first": 1675022400,
                "second": 1675026000
              },
              "venue": {
                "id": 1456,
                "name": "Estadio Santiago Bernabéu",
                "city": "Madrid"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 140,
              "name": "La Liga",
              "country": "Spain",
              "logo": "https://media.api-sports.io/football/leagues/140.png",
              "flag": "https://media.api-sports.io/flags/es.svg",
              "season": 2022,
              "round": "Regular Season - 19",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 541,
                "name": "Real Madrid",
                "logo": "https://media.api-sports.io/football/teams/541.png",
                "winner": undefined
              },
              "away": {
                "id": 548,
                "name": "Real Sociedad",
                "logo": "https://media.api-sports.io/football/teams/548.png",
                "winner": undefined
              }
            },
            "goals": {
              "home": 0,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 0,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 878139,
              "referee": "Pablo González",
              "timezone": "UTC",
              "date": "2023-02-05T17:30:00+00:00",
              "timestamp": 1675618200,
              "periods": {
                "first": 1675618200,
                "second": 1675621800
              },
              "venue": {
                "id": 1491,
                "name": "Reale Arena",
                "city": "Donostia-San Sebastián"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 140,
              "name": "La Liga",
              "country": "Spain",
              "logo": "https://media.api-sports.io/football/leagues/140.png",
              "flag": "https://media.api-sports.io/flags/es.svg",
              "season": 2022,
              "round": "Regular Season - 20",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 548,
                "name": "Real Sociedad",
                "logo": "https://media.api-sports.io/football/teams/548.png",
                "winner": false
              },
              "away": {
                "id": 720,
                "name": "Valladolid",
                "logo": "https://media.api-sports.io/football/teams/720.png",
                "winner": true
              }
            },
            "goals": {
              "home": 0,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 0,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 878144,
              "referee": "Alejandro Muñiz",
              "timezone": "UTC",
              "date": "2023-02-13T20:00:00+00:00",
              "timestamp": 1676318400,
              "periods": {
                "first": 1676318400,
                "second": 1676322000
              },
              "venue": {
                "id": 1474,
                "name": "RCDE Stadium",
                "city": "Cornella de Llobregat"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 140,
              "name": "La Liga",
              "country": "Spain",
              "logo": "https://media.api-sports.io/football/leagues/140.png",
              "flag": "https://media.api-sports.io/flags/es.svg",
              "season": 2022,
              "round": "Regular Season - 21",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 540,
                "name": "Espanyol",
                "logo": "https://media.api-sports.io/football/teams/540.png",
                "winner": false
              },
              "away": {
                "id": 548,
                "name": "Real Sociedad",
                "logo": "https://media.api-sports.io/football/teams/548.png",
                "winner": true
              }
            },
            "goals": {
              "home": 2,
              "away": 3
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 1
              },
              "fulltime": {
                "home": 2,
                "away": 3
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 878160,
              "referee": "Miguel Ortiz",
              "timezone": "UTC",
              "date": "2023-02-18T13:00:00+00:00",
              "timestamp": 1676725200,
              "periods": {
                "first": 1676725200,
                "second": 1676728800
              },
              "venue": {
                "id": 1491,
                "name": "Reale Arena",
                "city": "Donostia-San Sebastián"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 140,
              "name": "La Liga",
              "country": "Spain",
              "logo": "https://media.api-sports.io/football/leagues/140.png",
              "flag": "https://media.api-sports.io/flags/es.svg",
              "season": 2022,
              "round": "Regular Season - 22",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 548,
                "name": "Real Sociedad",
                "logo": "https://media.api-sports.io/football/teams/548.png",
                "winner": undefined
              },
              "away": {
                "id": 538,
                "name": "Celta Vigo",
                "logo": "https://media.api-sports.io/football/teams/538.png",
                "winner": undefined
              }
            },
            "goals": {
              "home": 1,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 0
              },
              "fulltime": {
                "home": 1,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 878171,
              "referee": "Alejandro Hernández",
              "timezone": "UTC",
              "date": "2023-02-25T20:00:00+00:00",
              "timestamp": 1677355200,
              "periods": {
                "first": 1677355200,
                "second": 1677358800
              },
              "venue": {
                "id": 1497,
                "name": "Estadio de Mestalla",
                "city": "Valencia"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 140,
              "name": "La Liga",
              "country": "Spain",
              "logo": "https://media.api-sports.io/football/leagues/140.png",
              "flag": "https://media.api-sports.io/flags/es.svg",
              "season": 2022,
              "round": "Regular Season - 23",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 532,
                "name": "Valencia",
                "logo": "https://media.api-sports.io/football/teams/532.png",
                "winner": true
              },
              "away": {
                "id": 548,
                "name": "Real Sociedad",
                "logo": "https://media.api-sports.io/football/teams/548.png",
                "winner": false
              }
            },
            "goals": {
              "home": 1,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 0
              },
              "fulltime": {
                "home": 1,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 878180,
              "referee": "Antonio Mateu",
              "timezone": "UTC",
              "date": "2023-03-03T20:00:00+00:00",
              "timestamp": 1677873600,
              "periods": {
                "first": 1677873600,
                "second": 1677877200
              },
              "venue": {
                "id": 1491,
                "name": "Reale Arena",
                "city": "Donostia-San Sebastián"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 140,
              "name": "La Liga",
              "country": "Spain",
              "logo": "https://media.api-sports.io/football/leagues/140.png",
              "flag": "https://media.api-sports.io/flags/es.svg",
              "season": 2022,
              "round": "Regular Season - 24",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 548,
                "name": "Real Sociedad",
                "logo": "https://media.api-sports.io/football/teams/548.png",
                "winner": undefined
              },
              "away": {
                "id": 724,
                "name": "Cadiz",
                "logo": "https://media.api-sports.io/football/teams/724.png",
                "winner": undefined
              }
            },
            "goals": {
              "home": 0,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 0,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 878185,
              "referee": "Juan Martínez",
              "timezone": "UTC",
              "date": "2023-03-12T13:00:00+00:00",
              "timestamp": 1678626000,
              "periods": {
                "first": 1678626000,
                "second": 1678629600
              },
              "venue": {
                "id": 12597,
                "name": "Visit Mallorca Estadi",
                "city": "Palma de Mallorca"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 140,
              "name": "La Liga",
              "country": "Spain",
              "logo": "https://media.api-sports.io/football/leagues/140.png",
              "flag": "https://media.api-sports.io/flags/es.svg",
              "season": 2022,
              "round": "Regular Season - 25",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 798,
                "name": "Mallorca",
                "logo": "https://media.api-sports.io/football/teams/798.png",
                "winner": undefined
              },
              "away": {
                "id": 548,
                "name": "Real Sociedad",
                "logo": "https://media.api-sports.io/football/teams/548.png",
                "winner": undefined
              }
            },
            "goals": {
              "home": 1,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 1
              },
              "fulltime": {
                "home": 1,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 878200,
              "referee": "José Sánchez",
              "timezone": "UTC",
              "date": "2023-03-19T15:15:00+00:00",
              "timestamp": 1679238900,
              "periods": {
                "first": 1679238900,
                "second": 1679242500
              },
              "venue": {
                "id": 1491,
                "name": "Reale Arena",
                "city": "Donostia-San Sebastián"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 140,
              "name": "La Liga",
              "country": "Spain",
              "logo": "https://media.api-sports.io/football/leagues/140.png",
              "flag": "https://media.api-sports.io/flags/es.svg",
              "season": 2022,
              "round": "Regular Season - 26",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 548,
                "name": "Real Sociedad",
                "logo": "https://media.api-sports.io/football/teams/548.png",
                "winner": true
              },
              "away": {
                "id": 797,
                "name": "Elche",
                "logo": "https://media.api-sports.io/football/teams/797.png",
                "winner": false
              }
            },
            "goals": {
              "home": 2,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 2,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 878209,
              "referee": "Jesús Gil",
              "timezone": "UTC",
              "date": "2023-04-02T16:30:00+00:00",
              "timestamp": 1680453000,
              "periods": {
                "first": 1680453000,
                "second": 1680456600
              },
              "venue": {
                "id": 1498,
                "name": "Estadio de la Cerámica",
                "city": "Villarreal"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 140,
              "name": "La Liga",
              "country": "Spain",
              "logo": "https://media.api-sports.io/football/leagues/140.png",
              "flag": "https://media.api-sports.io/flags/es.svg",
              "season": 2022,
              "round": "Regular Season - 27",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 533,
                "name": "Villarreal",
                "logo": "https://media.api-sports.io/football/teams/533.png",
                "winner": true
              },
              "away": {
                "id": 548,
                "name": "Real Sociedad",
                "logo": "https://media.api-sports.io/football/teams/548.png",
                "winner": false
              }
            },
            "goals": {
              "home": 2,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 2,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 878221,
              "referee": "Mario Melero",
              "timezone": "UTC",
              "date": "2023-04-08T16:30:00+00:00",
              "timestamp": 1680971400,
              "periods": {
                "first": 1680971400,
                "second": 1680975000
              },
              "venue": {
                "id": 1491,
                "name": "Reale Arena",
                "city": "Donostia-San Sebastián"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 140,
              "name": "La Liga",
              "country": "Spain",
              "logo": "https://media.api-sports.io/football/leagues/140.png",
              "flag": "https://media.api-sports.io/flags/es.svg",
              "season": 2022,
              "round": "Regular Season - 28",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 548,
                "name": "Real Sociedad",
                "logo": "https://media.api-sports.io/football/teams/548.png",
                "winner": true
              },
              "away": {
                "id": 546,
                "name": "Getafe",
                "logo": "https://media.api-sports.io/football/teams/546.png",
                "winner": false
              }
            },
            "goals": {
              "home": 2,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 0
              },
              "fulltime": {
                "home": 2,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 878222,
              "referee": "César Soto",
              "timezone": "UTC",
              "date": "2023-04-15T14:15:00+00:00",
              "timestamp": 1681568100,
              "periods": {
                "first": 1681568100,
                "second": 1681571700
              },
              "venue": {
                "id": 1460,
                "name": "San Mamés Barria",
                "city": "Bilbao"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 140,
              "name": "La Liga",
              "country": "Spain",
              "logo": "https://media.api-sports.io/football/leagues/140.png",
              "flag": "https://media.api-sports.io/flags/es.svg",
              "season": 2022,
              "round": "Regular Season - 29",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 531,
                "name": "Athletic Club",
                "logo": "https://media.api-sports.io/football/teams/531.png",
                "winner": true
              },
              "away": {
                "id": 548,
                "name": "Real Sociedad",
                "logo": "https://media.api-sports.io/football/teams/548.png",
                "winner": false
              }
            },
            "goals": {
              "home": 2,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 0
              },
              "fulltime": {
                "home": 2,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 878240,
              "referee": "Alejandro Muñiz",
              "timezone": "UTC",
              "date": "2023-04-22T16:30:00+00:00",
              "timestamp": 1682181000,
              "periods": {
                "first": 1682181000,
                "second": 1682184600
              },
              "venue": {
                "id": 1491,
                "name": "Reale Arena",
                "city": "Donostia-San Sebastián"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 140,
              "name": "La Liga",
              "country": "Spain",
              "logo": "https://media.api-sports.io/football/leagues/140.png",
              "flag": "https://media.api-sports.io/flags/es.svg",
              "season": 2022,
              "round": "Regular Season - 30",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 548,
                "name": "Real Sociedad",
                "logo": "https://media.api-sports.io/football/teams/548.png",
                "winner": true
              },
              "away": {
                "id": 728,
                "name": "Rayo Vallecano",
                "logo": "https://media.api-sports.io/football/teams/728.png",
                "winner": false
              }
            },
            "goals": {
              "home": 2,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 2,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 878244,
              "referee": "Juan Martínez",
              "timezone": "UTC",
              "date": "2023-04-25T20:00:00+00:00",
              "timestamp": 1682452800,
              "periods": {
                "first": 1682452800,
                "second": 1682456400
              },
              "venue": {
                "id": 1489,
                "name": "Estadio Benito Villamarín",
                "city": "Sevilla"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 140,
              "name": "La Liga",
              "country": "Spain",
              "logo": "https://media.api-sports.io/football/leagues/140.png",
              "flag": "https://media.api-sports.io/flags/es.svg",
              "season": 2022,
              "round": "Regular Season - 31",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 543,
                "name": "Real Betis",
                "logo": "https://media.api-sports.io/football/teams/543.png",
                "winner": undefined
              },
              "away": {
                "id": 548,
                "name": "Real Sociedad",
                "logo": "https://media.api-sports.io/football/teams/548.png",
                "winner": undefined
              }
            },
            "goals": {
              "home": 0,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 0,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 878256,
              "referee": "Valentín Pizarro",
              "timezone": "UTC",
              "date": "2023-04-28T19:00:00+00:00",
              "timestamp": 1682708400,
              "periods": {
                "first": 1682708400,
                "second": 1682712000
              },
              "venue": {
                "id": 1486,
                "name": "Estadio El Sadar",
                "city": "Iruñea"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 140,
              "name": "La Liga",
              "country": "Spain",
              "logo": "https://media.api-sports.io/football/leagues/140.png",
              "flag": "https://media.api-sports.io/flags/es.svg",
              "season": 2022,
              "round": "Regular Season - 32",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 727,
                "name": "Osasuna",
                "logo": "https://media.api-sports.io/football/teams/727.png",
                "winner": false
              },
              "away": {
                "id": 548,
                "name": "Real Sociedad",
                "logo": "https://media.api-sports.io/football/teams/548.png",
                "winner": true
              }
            },
            "goals": {
              "home": 0,
              "away": 2
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 1
              },
              "fulltime": {
                "home": 0,
                "away": 2
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 878271,
              "referee": "Juan Pulido",
              "timezone": "UTC",
              "date": "2023-05-02T20:00:00+00:00",
              "timestamp": 1683057600,
              "periods": {
                "first": 1683057600,
                "second": 1683061200
              },
              "venue": {
                "id": 1491,
                "name": "Reale Arena",
                "city": "Donostia-San Sebastián"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 140,
              "name": "La Liga",
              "country": "Spain",
              "logo": "https://media.api-sports.io/football/leagues/140.png",
              "flag": "https://media.api-sports.io/flags/es.svg",
              "season": 2022,
              "round": "Regular Season - 33",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 548,
                "name": "Real Sociedad",
                "logo": "https://media.api-sports.io/football/teams/548.png",
                "winner": true
              },
              "away": {
                "id": 541,
                "name": "Real Madrid",
                "logo": "https://media.api-sports.io/football/teams/541.png",
                "winner": false
              }
            },
            "goals": {
              "home": 2,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 2,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 878281,
              "referee": "Jorge Figueroa",
              "timezone": "UTC",
              "date": "2023-05-13T12:00:00+00:00",
              "timestamp": 1683979200,
              "periods": {
                "first": 1683979200,
                "second": 1683982800
              },
              "venue": {
                "id": 1491,
                "name": "Reale Arena",
                "city": "Donostia-San Sebastián"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 140,
              "name": "La Liga",
              "country": "Spain",
              "logo": "https://media.api-sports.io/football/leagues/140.png",
              "flag": "https://media.api-sports.io/flags/es.svg",
              "season": 2022,
              "round": "Regular Season - 34",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 548,
                "name": "Real Sociedad",
                "logo": "https://media.api-sports.io/football/teams/548.png",
                "winner": undefined
              },
              "away": {
                "id": 547,
                "name": "Girona",
                "logo": "https://media.api-sports.io/football/teams/547.png",
                "winner": undefined
              }
            },
            "goals": {
              "home": 2,
              "away": 2
            },
            "score": {
              "halftime": {
                "home": 2,
                "away": 2
              },
              "fulltime": {
                "home": 2,
                "away": 2
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 878284,
              "referee": "Javier Alberola",
              "timezone": "UTC",
              "date": "2023-05-20T19:00:00+00:00",
              "timestamp": 1684609200,
              "periods": {
                "first": 1684609200,
                "second": 1684612800
              },
              "venue": {
                "id": 18630,
                "name": "Spotify Camp Nou",
                "city": "Barcelona"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 140,
              "name": "La Liga",
              "country": "Spain",
              "logo": "https://media.api-sports.io/football/leagues/140.png",
              "flag": "https://media.api-sports.io/flags/es.svg",
              "season": 2022,
              "round": "Regular Season - 35",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 529,
                "name": "Barcelona",
                "logo": "https://media.api-sports.io/football/teams/529.png",
                "winner": false
              },
              "away": {
                "id": 548,
                "name": "Real Sociedad",
                "logo": "https://media.api-sports.io/football/teams/548.png",
                "winner": true
              }
            },
            "goals": {
              "home": 1,
              "away": 2
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 1
              },
              "fulltime": {
                "home": 1,
                "away": 2
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 878301,
              "referee": "Pablo González",
              "timezone": "UTC",
              "date": "2023-05-23T17:30:00+00:00",
              "timestamp": 1684863000,
              "periods": {
                "first": 1684863000,
                "second": 1684866600
              },
              "venue": {
                "id": 1491,
                "name": "Reale Arena",
                "city": "Donostia-San Sebastián"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 140,
              "name": "La Liga",
              "country": "Spain",
              "logo": "https://media.api-sports.io/football/leagues/140.png",
              "flag": "https://media.api-sports.io/flags/es.svg",
              "season": 2022,
              "round": "Regular Season - 36",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 548,
                "name": "Real Sociedad",
                "logo": "https://media.api-sports.io/football/teams/548.png",
                "winner": true
              },
              "away": {
                "id": 723,
                "name": "Almeria",
                "logo": "https://media.api-sports.io/football/teams/723.png",
                "winner": false
              }
            },
            "goals": {
              "home": 1,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 0
              },
              "fulltime": {
                "home": 1,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 878303,
              "referee": "Juan Pulido",
              "timezone": "UTC",
              "date": "2023-05-28T17:00:00+00:00",
              "timestamp": 1685293200,
              "periods": {
                "first": 1685293200,
                "second": 1685296800
              },
              "venue": {
                "id": 19217,
                "name": "Estádio Cívitas Metropolitano",
                "city": "Madrid"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 140,
              "name": "La Liga",
              "country": "Spain",
              "logo": "https://media.api-sports.io/football/leagues/140.png",
              "flag": "https://media.api-sports.io/flags/es.svg",
              "season": 2022,
              "round": "Regular Season - 37",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 530,
                "name": "Atletico Madrid",
                "logo": "https://media.api-sports.io/football/teams/530.png",
                "winner": true
              },
              "away": {
                "id": 548,
                "name": "Real Sociedad",
                "logo": "https://media.api-sports.io/football/teams/548.png",
                "winner": false
              }
            },
            "goals": {
              "home": 2,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 0
              },
              "fulltime": {
                "home": 2,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 878314,
              "referee": "Carlos del Cerro",
              "timezone": "UTC",
              "date": "2023-06-04T16:30:00+00:00",
              "timestamp": 1685896200,
              "periods": {
                "first": 1685896200,
                "second": 1685899800
              },
              "venue": {
                "id": 1491,
                "name": "Reale Arena",
                "city": "Donostia-San Sebastián"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 140,
              "name": "La Liga",
              "country": "Spain",
              "logo": "https://media.api-sports.io/football/leagues/140.png",
              "flag": "https://media.api-sports.io/flags/es.svg",
              "season": 2022,
              "round": "Regular Season - 38",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 548,
                "name": "Real Sociedad",
                "logo": "https://media.api-sports.io/football/teams/548.png",
                "winner": true
              },
              "away": {
                "id": 536,
                "name": "Sevilla",
                "logo": "https://media.api-sports.io/football/teams/536.png",
                "winner": false
              }
            },
            "goals": {
              "home": 2,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 0
              },
              "fulltime": {
                "home": 2,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 891500,
              "referee": undefined,
              "timezone": "UTC",
              "date": "2022-07-16T17:00:00+00:00",
              "timestamp": 1657990800,
              "periods": {
                "first": 1657990800,
                "second": 1657994400
              },
              "venue": {
                "id": 1491,
                "name": "Reale Arena",
                "city": "Donostia-San Sebastián"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 667,
              "name": "Friendlies Clubs",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/667.png",
              "flag": undefined,
              "season": 2022,
              "round": "Club Friendlies 3",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 548,
                "name": "Real Sociedad",
                "logo": "https://media.api-sports.io/football/teams/548.png",
                "winner": false
              },
              "away": {
                "id": 96,
                "name": "Toulouse",
                "logo": "https://media.api-sports.io/football/teams/96.png",
                "winner": true
              }
            },
            "goals": {
              "home": 0,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 0,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 922498,
              "referee": undefined,
              "timezone": "UTC",
              "date": "2022-07-27T17:00:00+00:00",
              "timestamp": 1658941200,
              "periods": {
                "first": 1658941200,
                "second": 1658944800
              },
              "venue": {
                "id": undefined,
                "name": "Instalaciones de Zubieta",
                "city": "Donostia-San Sebastián"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 667,
              "name": "Friendlies Clubs",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/667.png",
              "flag": undefined,
              "season": 2022,
              "round": "Club Friendlies 3",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 548,
                "name": "Real Sociedad",
                "logo": "https://media.api-sports.io/football/teams/548.png",
                "winner": true
              },
              "away": {
                "id": 727,
                "name": "Osasuna",
                "logo": "https://media.api-sports.io/football/teams/727.png",
                "winner": false
              }
            },
            "goals": {
              "home": 1,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 1,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 946761,
              "referee": "M. Di Bello",
              "timezone": "UTC",
              "date": "2022-09-08T19:00:00+00:00",
              "timestamp": 1662663600,
              "periods": {
                "first": 1662663600,
                "second": 1662667200
              },
              "venue": {
                "id": 556,
                "name": "Old Trafford",
                "city": "Manchester"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 3,
              "name": "UEFA Europa League",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/3.png",
              "flag": undefined,
              "season": 2022,
              "round": "Group Stage - 1",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 33,
                "name": "Manchester United",
                "logo": "https://media.api-sports.io/football/teams/33.png",
                "winner": false
              },
              "away": {
                "id": 548,
                "name": "Real Sociedad",
                "logo": "https://media.api-sports.io/football/teams/548.png",
                "winner": true
              }
            },
            "goals": {
              "home": 0,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 0,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 946769,
              "referee": "K. Tohver",
              "timezone": "UTC",
              "date": "2022-09-15T16:45:00+00:00",
              "timestamp": 1663260300,
              "periods": {
                "first": 1663260300,
                "second": 1663263900
              },
              "venue": {
                "id": 1491,
                "name": "Reale Arena",
                "city": "Donostia-San Sebastián"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 3,
              "name": "UEFA Europa League",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/3.png",
              "flag": undefined,
              "season": 2022,
              "round": "Group Stage - 2",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 548,
                "name": "Real Sociedad",
                "logo": "https://media.api-sports.io/football/teams/548.png",
                "winner": true
              },
              "away": {
                "id": 3402,
                "name": "Omonia Nicosia",
                "logo": "https://media.api-sports.io/football/teams/3402.png",
                "winner": false
              }
            },
            "goals": {
              "home": 2,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 0
              },
              "fulltime": {
                "home": 2,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 946788,
              "referee": "H. Lechner",
              "timezone": "UTC",
              "date": "2022-10-06T16:45:00+00:00",
              "timestamp": 1665074700,
              "periods": {
                "first": 1665074700,
                "second": 1665078300
              },
              "venue": {
                "id": 2615,
                "name": "Stadionul Zimbru",
                "city": "Chişinău"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 3,
              "name": "UEFA Europa League",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/3.png",
              "flag": undefined,
              "season": 2022,
              "round": "Group Stage - 3",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 568,
                "name": "Sheriff Tiraspol",
                "logo": "https://media.api-sports.io/football/teams/568.png",
                "winner": false
              },
              "away": {
                "id": 548,
                "name": "Real Sociedad",
                "logo": "https://media.api-sports.io/football/teams/548.png",
                "winner": true
              }
            },
            "goals": {
              "home": 0,
              "away": 2
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 0,
                "away": 2
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 946813,
              "referee": "E. Jorgji",
              "timezone": "UTC",
              "date": "2022-10-13T19:00:00+00:00",
              "timestamp": 1665687600,
              "periods": {
                "first": 1665687600,
                "second": 1665691200
              },
              "venue": {
                "id": 1491,
                "name": "Reale Arena",
                "city": "Donostia-San Sebastián"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 3,
              "name": "UEFA Europa League",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/3.png",
              "flag": undefined,
              "season": 2022,
              "round": "Group Stage - 4",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 548,
                "name": "Real Sociedad",
                "logo": "https://media.api-sports.io/football/teams/548.png",
                "winner": true
              },
              "away": {
                "id": 568,
                "name": "Sheriff Tiraspol",
                "logo": "https://media.api-sports.io/football/teams/568.png",
                "winner": false
              }
            },
            "goals": {
              "home": 3,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 0
              },
              "fulltime": {
                "home": 3,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 946826,
              "referee": "T. Bognár",
              "timezone": "UTC",
              "date": "2022-10-27T19:00:00+00:00",
              "timestamp": 1666897200,
              "periods": {
                "first": 1666897200,
                "second": 1666900800
              },
              "venue": {
                "id": undefined,
                "name": "Neo GSP",
                "city": "Levkosía"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 3,
              "name": "UEFA Europa League",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/3.png",
              "flag": undefined,
              "season": 2022,
              "round": "Group Stage - 5",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 3402,
                "name": "Omonia Nicosia",
                "logo": "https://media.api-sports.io/football/teams/3402.png",
                "winner": false
              },
              "away": {
                "id": 548,
                "name": "Real Sociedad",
                "logo": "https://media.api-sports.io/football/teams/548.png",
                "winner": true
              }
            },
            "goals": {
              "home": 0,
              "away": 2
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 1
              },
              "fulltime": {
                "home": 0,
                "away": 2
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 946833,
              "referee": "G. Kabakov",
              "timezone": "UTC",
              "date": "2022-11-03T17:45:00+00:00",
              "timestamp": 1667497500,
              "periods": {
                "first": 1667497500,
                "second": 1667501100
              },
              "venue": {
                "id": 1491,
                "name": "Reale Arena",
                "city": "Donostia-San Sebastián"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 3,
              "name": "UEFA Europa League",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/3.png",
              "flag": undefined,
              "season": 2022,
              "round": "Group Stage - 6",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 548,
                "name": "Real Sociedad",
                "logo": "https://media.api-sports.io/football/teams/548.png",
                "winner": false
              },
              "away": {
                "id": 33,
                "name": "Manchester United",
                "logo": "https://media.api-sports.io/football/teams/33.png",
                "winner": true
              }
            },
            "goals": {
              "home": 0,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 1
              },
              "fulltime": {
                "home": 0,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 959717,
              "referee": undefined,
              "timezone": "UTC",
              "date": "2022-08-05T09:00:00+00:00",
              "timestamp": 1659690000,
              "periods": {
                "first": 1659690000,
                "second": 1659693600
              },
              "venue": {
                "id": undefined,
                "name": "Estadio Zubieta XXI",
                "city": "Donostia-San Sebastián"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 667,
              "name": "Friendlies Clubs",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/667.png",
              "flag": undefined,
              "season": 2022,
              "round": "Club Friendlies 3",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 548,
                "name": "Real Sociedad",
                "logo": "https://media.api-sports.io/football/teams/548.png",
                "winner": false
              },
              "away": {
                "id": 545,
                "name": "Eibar",
                "logo": "https://media.api-sports.io/football/teams/545.png",
                "winner": true
              }
            },
            "goals": {
              "home": 1,
              "away": 2
            },
            "score": {
              "halftime": {
                "home": undefined,
                "away": undefined
              },
              "fulltime": {
                "home": 1,
                "away": 2
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 959724,
              "referee": undefined,
              "timezone": "UTC",
              "date": "2022-08-05T18:45:00+00:00",
              "timestamp": 1659725100,
              "periods": {
                "first": 1659725100,
                "second": 1659728700
              },
              "venue": {
                "id": 3965,
                "name": "Estadio Nuevo Lasesarre",
                "city": "Barakaldo"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 667,
              "name": "Friendlies Clubs",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/667.png",
              "flag": undefined,
              "season": 2022,
              "round": "Club Friendlies 3",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 531,
                "name": "Athletic Club",
                "logo": "https://media.api-sports.io/football/teams/531.png",
                "winner": true
              },
              "away": {
                "id": 548,
                "name": "Real Sociedad",
                "logo": "https://media.api-sports.io/football/teams/548.png",
                "winner": false
              }
            },
            "goals": {
              "home": 1,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": undefined,
                "away": undefined
              },
              "fulltime": {
                "home": 1,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 968515,
              "referee": "Mario Melero",
              "timezone": "UTC",
              "date": "2022-11-13T18:00:00+00:00",
              "timestamp": 1668362400,
              "periods": {
                "first": 1668362400,
                "second": 1668366000
              },
              "venue": {
                "id": 3967,
                "name": "Estadio El Prado",
                "city": "Talavera de la Reina"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 143,
              "name": "Copa del Rey",
              "country": "Spain",
              "logo": "https://media.api-sports.io/football/leagues/143.png",
              "flag": "https://media.api-sports.io/flags/es.svg",
              "season": 2022,
              "round": "1st Round",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 20443,
                "name": "Cazalegas",
                "logo": "https://media.api-sports.io/football/teams/20443.png",
                "winner": false
              },
              "away": {
                "id": 548,
                "name": "Real Sociedad",
                "logo": "https://media.api-sports.io/football/teams/548.png",
                "winner": true
              }
            },
            "goals": {
              "home": 1,
              "away": 4
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 1
              },
              "fulltime": {
                "home": 1,
                "away": 4
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 973576,
              "referee": "Alejandro Muñiz",
              "timezone": "UTC",
              "date": "2022-12-21T20:00:00+00:00",
              "timestamp": 1671652800,
              "periods": {
                "first": 1671652800,
                "second": 1671656400
              },
              "venue": {
                "id": 6907,
                "name": "Estadio La Isla",
                "city": "Coria"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 143,
              "name": "Copa del Rey",
              "country": "Spain",
              "logo": "https://media.api-sports.io/football/leagues/143.png",
              "flag": "https://media.api-sports.io/flags/es.svg",
              "season": 2022,
              "round": "2nd Round",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 9827,
                "name": "CD Coria",
                "logo": "https://media.api-sports.io/football/teams/9827.png",
                "winner": false
              },
              "away": {
                "id": 548,
                "name": "Real Sociedad",
                "logo": "https://media.api-sports.io/football/teams/548.png",
                "winner": true
              }
            },
            "goals": {
              "home": 0,
              "away": 5
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 3
              },
              "fulltime": {
                "home": 0,
                "away": 5
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 977260,
              "referee": undefined,
              "timezone": "UTC",
              "date": "2022-12-16T19:45:00+00:00",
              "timestamp": 1671219900,
              "periods": {
                "first": 1671219900,
                "second": 1671223500
              },
              "venue": {
                "id": 546,
                "name": "Elland Road",
                "city": "Leeds, West Yorkshire"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 667,
              "name": "Friendlies Clubs",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/667.png",
              "flag": undefined,
              "season": 2022,
              "round": "Club Friendlies 3",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 63,
                "name": "Leeds",
                "logo": "https://media.api-sports.io/football/teams/63.png",
                "winner": true
              },
              "away": {
                "id": 548,
                "name": "Real Sociedad",
                "logo": "https://media.api-sports.io/football/teams/548.png",
                "winner": false
              }
            },
            "goals": {
              "home": 2,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 1
              },
              "fulltime": {
                "home": 2,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 979560,
              "referee": undefined,
              "timezone": "UTC",
              "date": "2022-12-10T00:00:00+00:00",
              "timestamp": 1670630400,
              "periods": {
                "first": 1670630400,
                "second": 1670634000
              },
              "venue": {
                "id": 1491,
                "name": "Reale Arena",
                "city": "Donostia-San Sebastián"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 667,
              "name": "Friendlies Clubs",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/667.png",
              "flag": undefined,
              "season": 2022,
              "round": "Club Friendlies 3",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 548,
                "name": "Real Sociedad",
                "logo": "https://media.api-sports.io/football/teams/548.png",
                "winner": undefined
              },
              "away": {
                "id": 728,
                "name": "Rayo Vallecano",
                "logo": "https://media.api-sports.io/football/teams/728.png",
                "winner": undefined
              }
            },
            "goals": {
              "home": 1,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": undefined,
                "away": undefined
              },
              "fulltime": {
                "home": 1,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 979672,
              "referee": undefined,
              "timezone": "UTC",
              "date": "2022-12-10T18:00:00+00:00",
              "timestamp": 1670695200,
              "periods": {
                "first": undefined,
                "second": undefined
              },
              "venue": {
                "id": undefined,
                "name": undefined,
                "city": undefined
              },
              "status": {
                "long": "Match Cancelled",
                "short": "CANC",
                "elapsed": undefined,
                "extra": undefined
              }
            },
            "league": {
              "id": 667,
              "name": "Friendlies Clubs",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/667.png",
              "flag": undefined,
              "season": 2022,
              "round": "Club Friendlies 5",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 548,
                "name": "Real Sociedad",
                "logo": "https://media.api-sports.io/football/teams/548.png",
                "winner": undefined
              },
              "away": {
                "id": 554,
                "name": "Anderlecht",
                "logo": "https://media.api-sports.io/football/teams/554.png",
                "winner": undefined
              }
            },
            "goals": {
              "home": undefined,
              "away": undefined
            },
            "score": {
              "halftime": {
                "home": undefined,
                "away": undefined
              },
              "fulltime": {
                "home": undefined,
                "away": undefined
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 982780,
              "referee": "Pablo González",
              "timezone": "UTC",
              "date": "2023-01-04T18:00:00+00:00",
              "timestamp": 1672855200,
              "periods": {
                "first": 1672855200,
                "second": 1672858800
              },
              "venue": {
                "id": 3994,
                "name": "Estadio Nuevo Municipal Las Gaunas",
                "city": "Logroño"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 143,
              "name": "Copa del Rey",
              "country": "Spain",
              "logo": "https://media.api-sports.io/football/leagues/143.png",
              "flag": "https://media.api-sports.io/flags/es.svg",
              "season": 2022,
              "round": "Round of 32",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 5280,
                "name": "UD Logroñés",
                "logo": "https://media.api-sports.io/football/teams/5280.png",
                "winner": false
              },
              "away": {
                "id": 548,
                "name": "Real Sociedad",
                "logo": "https://media.api-sports.io/football/teams/548.png",
                "winner": true
              }
            },
            "goals": {
              "home": 0,
              "away": 1
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 1
              },
              "fulltime": {
                "home": 0,
                "away": 1
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 986145,
              "referee": "Alejandro Hernández",
              "timezone": "UTC",
              "date": "2023-01-17T18:00:00+00:00",
              "timestamp": 1673978400,
              "periods": {
                "first": 1673978400,
                "second": 1673982000
              },
              "venue": {
                "id": 1491,
                "name": "Reale Arena",
                "city": "Donostia-San Sebastián"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 143,
              "name": "Copa del Rey",
              "country": "Spain",
              "logo": "https://media.api-sports.io/football/leagues/143.png",
              "flag": "https://media.api-sports.io/flags/es.svg",
              "season": 2022,
              "round": "Round of 16",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 548,
                "name": "Real Sociedad",
                "logo": "https://media.api-sports.io/football/teams/548.png",
                "winner": true
              },
              "away": {
                "id": 798,
                "name": "Mallorca",
                "logo": "https://media.api-sports.io/football/teams/798.png",
                "winner": false
              }
            },
            "goals": {
              "home": 1,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 0
              },
              "fulltime": {
                "home": 1,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 992756,
              "referee": "Jesús Gil",
              "timezone": "UTC",
              "date": "2023-01-25T20:00:00+00:00",
              "timestamp": 1674676800,
              "periods": {
                "first": 1674676800,
                "second": 1674680400
              },
              "venue": {
                "id": 18630,
                "name": "Spotify Camp Nou",
                "city": "Barcelona"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 143,
              "name": "Copa del Rey",
              "country": "Spain",
              "logo": "https://media.api-sports.io/football/leagues/143.png",
              "flag": "https://media.api-sports.io/flags/es.svg",
              "season": 2022,
              "round": "Quarter-finals",
              "standings": false
            },
            "teams": {
              "home": {
                "id": 529,
                "name": "Barcelona",
                "logo": "https://media.api-sports.io/football/teams/529.png",
                "winner": true
              },
              "away": {
                "id": 548,
                "name": "Real Sociedad",
                "logo": "https://media.api-sports.io/football/teams/548.png",
                "winner": false
              }
            },
            "goals": {
              "home": 1,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 1,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 1010828,
              "referee": "S. Schärer",
              "timezone": "UTC",
              "date": "2023-03-09T17:45:00+00:00",
              "timestamp": 1678383900,
              "periods": {
                "first": 1678383900,
                "second": 1678387500
              },
              "venue": {
                "id": 910,
                "name": "Stadio Olimpico",
                "city": "Roma"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 3,
              "name": "UEFA Europa League",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/3.png",
              "flag": undefined,
              "season": 2022,
              "round": "Round of 16",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 497,
                "name": "AS Roma",
                "logo": "https://media.api-sports.io/football/teams/497.png",
                "winner": true
              },
              "away": {
                "id": 548,
                "name": "Real Sociedad",
                "logo": "https://media.api-sports.io/football/teams/548.png",
                "winner": false
              }
            },
            "goals": {
              "home": 2,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 1,
                "away": 0
              },
              "fulltime": {
                "home": 2,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          },
          {
            "fixture": {
              "id": 1010829,
              "referee": "I. Kovacs",
              "timezone": "UTC",
              "date": "2023-03-16T20:00:00+00:00",
              "timestamp": 1678996800,
              "periods": {
                "first": 1678996800,
                "second": 1679000400
              },
              "venue": {
                "id": 1491,
                "name": "Reale Arena",
                "city": "Donostia-San Sebastián"
              },
              "status": {
                "long": "Match Finished",
                "short": "FT",
                "elapsed": 90,
                "extra": undefined
              }
            },
            "league": {
              "id": 3,
              "name": "UEFA Europa League",
              "country": "World",
              "logo": "https://media.api-sports.io/football/leagues/3.png",
              "flag": undefined,
              "season": 2022,
              "round": "Round of 16",
              "standings": true
            },
            "teams": {
              "home": {
                "id": 548,
                "name": "Real Sociedad",
                "logo": "https://media.api-sports.io/football/teams/548.png",
                "winner": undefined
              },
              "away": {
                "id": 497,
                "name": "AS Roma",
                "logo": "https://media.api-sports.io/football/teams/497.png",
                "winner": undefined
              }
            },
            "goals": {
              "home": 0,
              "away": 0
            },
            "score": {
              "halftime": {
                "home": 0,
                "away": 0
              },
              "fulltime": {
                "home": 0,
                "away": 0
              },
              "extratime": {
                "home": undefined,
                "away": undefined
              },
              "penalty": {
                "home": undefined,
                "away": undefined
              }
            }
          }
        ]
      },
      "headers": {
        "date": "Sun, 23 Nov 2025 11:10:28 GMT",
        "content-type": "application/json",
        "transfer-encoding": "chunked",
        "connection": "keep-alive",
        "server": "cloudflare",
        "vary": "Accept-Encoding",
        "access-control-allow-origin": "*",
        "access-control-allow-credentials": "True",
        "access-control-allow-methods": "GET, OPTIONS",
        "access-control-allow-headers": "x-rapidapi-key, x-apisports-key, x-rapidapi-host",
        "x-ratelimit-limit": "10",
        "x-ratelimit-remaining": "8",
        "x-ratelimit-requests-limit": "100",
        "x-ratelimit-requests-remaining": "84",
        "x-ttl": "14400",
        "x-envoy-upstream-service-time": "15",
        "cache-control": "no-store, no-cache, must-revalidate",
        "pragma": "no-cache",
        "expires": "0",
        "strict-transport-security": "max-age=31536000; includeSubDomains",
        "cf-cache-status": "DYNAMIC",
        "nel": "{\"report_to\":\"cf-nel\",\"success_fraction\":0.0,\"max_age\":604800}",
        "report-to": "{\"group\":\"cf-nel\",\"max_age\":604800,\"endpoints\":[{\"url\":\"https://a.nel.cloudflare.com/report/v4?s=fto6rWDgqW5gv1druQpReurBzhSLC61OuFEr%2BXeJAPDGT%2FPUx2EZVZa8WGZwU6BNt1Y%2BuK3Sh69Fq5WpYNxFmNMmQ98jZ%2BHY%2Fvt8Q3ahhtT2FNOMRWx62Q%3D%3D\"}]}",
        "cf-ray": "9a3038645e2f5868-ARN"
      }
    }
  },
  {
    "request": {
      "method": "POST",
      "url": "https://rickandmortyapi.com/graphql",
      "headers": {
        "Content-Type": "application/json"
      },
      "queryParams": {}
    },
    "response": {
      "status": 200,
      "data": {
        "data": {
          "characters": {
            "results": [
              {
                "id": "41",
                "name": "Big Boobed Waitress",
                "status": "Alive",
                "species": "Mythological Creature"
              },
              {
                "id": "42",
                "name": "Big Head Morty",
                "status": "unknown",
                "species": "Human"
              },
              {
                "id": "43",
                "name": "Big Morty",
                "status": "Dead",
                "species": "Human"
              },
              {
                "id": "44",
                "name": "Body Guard Morty",
                "status": "Dead",
                "species": "Human"
              },
              {
                "id": "45",
                "name": "Bill",
                "status": "Alive",
                "species": "Human"
              },
              {
                "id": "46",
                "name": "Bill",
                "status": "unknown",
                "species": "Animal"
              },
              {
                "id": "47",
                "name": "Birdperson",
                "status": "Alive",
                "species": "Alien"
              },
              {
                "id": "48",
                "name": "Black Rick",
                "status": "Alive",
                "species": "Human"
              },
              {
                "id": "49",
                "name": "Blamph",
                "status": "Alive",
                "species": "Alien"
              },
              {
                "id": "50",
                "name": "Blim Blam",
                "status": "Alive",
                "species": "Alien"
              },
              {
                "id": "51",
                "name": "Blue Diplomat",
                "status": "Alive",
                "species": "Alien"
              },
              {
                "id": "52",
                "name": "Blue Footprint Guy",
                "status": "Dead",
                "species": "Human"
              },
              {
                "id": "53",
                "name": "Blue Shirt Morty",
                "status": "unknown",
                "species": "Human"
              },
              {
                "id": "54",
                "name": "Bobby Moynihan",
                "status": "Alive",
                "species": "Human"
              },
              {
                "id": "55",
                "name": "Boobloosian",
                "status": "Dead",
                "species": "Alien"
              },
              {
                "id": "56",
                "name": "Bootleg Portal Chemist Rick",
                "status": "Dead",
                "species": "Human"
              },
              {
                "id": "57",
                "name": "Borpocian",
                "status": "Alive",
                "species": "Alien"
              },
              {
                "id": "58",
                "name": "Brad",
                "status": "Alive",
                "species": "Human"
              },
              {
                "id": "59",
                "name": "Brad Anderson",
                "status": "Dead",
                "species": "Human"
              },
              {
                "id": "60",
                "name": "Calypso",
                "status": "Dead",
                "species": "Human"
              }
            ]
          }
        }
      },
      "headers": {
        "accept-ranges": "bytes",
        "access-control-allow-credentials": "true",
        "access-control-allow-headers": "*",
        "access-control-allow-methods": "POST, GET, HEAD, OPTIONS",
        "access-control-allow-origin": "*",
        "access-control-expose-headers": "*",
        "access-control-max-age": "600",
        "age": "744",
        "cache-control": "public,s-maxage=900,stale-while-revalidate=900",
        "cache-status": "\"Netlify Edge\"; fwd=method",
        "content-length": "526",
        "content-type": "application/json; charset=utf-8",
        "date": "Sun, 23 Nov 2025 18:50:11 GMT",
        "etag": "W/\"945-CYAD2uO7wyYRnoM+PSUpvqOtzVM\"",
        "expires": "Wed, 26 Nov 2025 18:37:48 GMT",
        "gcdn-cache": "HIT",
        "netlify-vary": "query",
        "server": "Netlify",
        "strict-transport-security": "max-age=31536000",
        "vary": "accept-encoding",
        "x-cache": "HIT",
        "x-cache-hits": "5",
        "x-nf-request-id": "01KAS0TPT4KYC3TQV9RZMEYE7W",
        "x-powered-by": "Stellate",
        "x-served-by": "cache-fra-etou8220179-FRA"
      }
    }
  },
  {
    "request": {
      "method": "POST",
      "url": "https://rickandmortyapi.com/graphql",
      "headers": {
        "Content-Type": "application/json"
      },
      "queryParams": {}
    },
    "response": {
      "status": 200,
      "data": {
        "data": {
          "characters": {
            "results": [
              {
                "id": "101",
                "name": "E. Coli",
                "status": "Dead",
                "species": "Disease"
              },
              {
                "id": "102",
                "name": "Donna Gueterman",
                "status": "Dead",
                "species": "Robot"
              },
              {
                "id": "103",
                "name": "Doofus Rick",
                "status": "unknown",
                "species": "Human"
              },
              {
                "id": "104",
                "name": "Doom-Nomitron",
                "status": "Dead",
                "species": "Alien"
              },
              {
                "id": "105",
                "name": "Dr. Glip-Glop",
                "status": "Dead",
                "species": "Alien"
              },
              {
                "id": "106",
                "name": "Dr. Schmidt",
                "status": "unknown",
                "species": "Human"
              },
              {
                "id": "107",
                "name": "Dr. Wong",
                "status": "Alive",
                "species": "Human"
              },
              {
                "id": "108",
                "name": "Dr. Xenon Bloom",
                "status": "Dead",
                "species": "Humanoid"
              },
              {
                "id": "109",
                "name": "Duck With Muscles",
                "status": "Dead",
                "species": "Alien"
              },
              {
                "id": "110",
                "name": "Eli",
                "status": "Alive",
                "species": "Human"
              },
              {
                "id": "111",
                "name": "Eli's Girlfriend",
                "status": "Alive",
                "species": "Human"
              },
              {
                "id": "112",
                "name": "Eric McMan",
                "status": "Alive",
                "species": "Human"
              },
              {
                "id": "113",
                "name": "Eric Stoltz Mask Morty",
                "status": "unknown",
                "species": "Human"
              },
              {
                "id": "114",
                "name": "Ethan",
                "status": "unknown",
                "species": "Human"
              },
              {
                "id": "115",
                "name": "Ethan",
                "status": "Alive",
                "species": "Human"
              },
              {
                "id": "116",
                "name": "Evil Beth Clone",
                "status": "Dead",
                "species": "Human"
              },
              {
                "id": "117",
                "name": "Evil Jerry Clone",
                "status": "Dead",
                "species": "Human"
              },
              {
                "id": "118",
                "name": "Evil Morty",
                "status": "Alive",
                "species": "Human"
              },
              {
                "id": "119",
                "name": "Evil Rick",
                "status": "Dead",
                "species": "Humanoid"
              },
              {
                "id": "120",
                "name": "Evil Summer Clone",
                "status": "Dead",
                "species": "Human"
              }
            ]
          }
        }
      },
      "headers": {
        "accept-ranges": "bytes",
        "access-control-allow-credentials": "true",
        "access-control-allow-headers": "*",
        "access-control-allow-methods": "POST, GET, HEAD, OPTIONS",
        "access-control-allow-origin": "*",
        "access-control-expose-headers": "*",
        "access-control-max-age": "600",
        "age": "1",
        "cache-control": "public,s-maxage=900,stale-while-revalidate=900",
        "cache-status": "\"Netlify Edge\"; fwd=method",
        "content-length": "523",
        "content-type": "application/json; charset=utf-8",
        "date": "Sun, 23 Nov 2025 18:59:52 GMT",
        "etag": "W/\"954-MNV/s/SQrnxDxwDr2UC2pwFozkM\"",
        "expires": "Wed, 26 Nov 2025 18:59:52 GMT",
        "gcdn-cache": "MISS",
        "netlify-vary": "query",
        "server": "Netlify",
        "strict-transport-security": "max-age=31536000",
        "vary": "accept-encoding",
        "x-cache": "MISS",
        "x-cache-hits": "0",
        "x-nf-request-id": "01KAS1CED7V22WPFJB563AAK4H",
        "x-powered-by": "Stellate",
        "x-served-by": "cache-fra-etou8220179-FRA"
      }
    }
  },
  {
    "request": {
      "method": "POST",
      "url": "https://rickandmortyapi.com/graphql",
      "headers": {
        "Content-Type": "application/json"
      },
      "queryParams": {}
    },
    "response": {
      "status": 200,
      "data": {
        "data": {
          "characters": {
            "results": [
              {
                "id": "61",
                "name": "Campaign Manager Morty",
                "status": "Dead",
                "species": "Human"
              },
              {
                "id": "62",
                "name": "Canklanker Thom",
                "status": "Dead",
                "species": "Alien"
              },
              {
                "id": "63",
                "name": "Centaur",
                "status": "Alive",
                "species": "Mythological Creature"
              },
              {
                "id": "64",
                "name": "Chris",
                "status": "Dead",
                "species": "Alien"
              },
              {
                "id": "65",
                "name": "Chris",
                "status": "Alive",
                "species": "Humanoid"
              },
              {
                "id": "66",
                "name": "Coach Feratu (Balik Alistane)",
                "status": "Dead",
                "species": "Mythological Creature"
              },
              {
                "id": "67",
                "name": "Collector",
                "status": "Alive",
                "species": "Alien"
              },
              {
                "id": "68",
                "name": "Colossus",
                "status": "Dead",
                "species": "Human"
              },
              {
                "id": "69",
                "name": "Commander Rick",
                "status": "Dead",
                "species": "Human"
              },
              {
                "id": "70",
                "name": "Concerto",
                "status": "Dead",
                "species": "Humanoid"
              },
              {
                "id": "71",
                "name": "Conroy",
                "status": "Dead",
                "species": "Robot"
              },
              {
                "id": "72",
                "name": "Cool Rick",
                "status": "Alive",
                "species": "Human"
              },
              {
                "id": "73",
                "name": "Cop Morty",
                "status": "Dead",
                "species": "Human"
              },
              {
                "id": "74",
                "name": "Cop Rick",
                "status": "Alive",
                "species": "Human"
              },
              {
                "id": "75",
                "name": "Courier Flap",
                "status": "Alive",
                "species": "Alien"
              },
              {
                "id": "76",
                "name": "Cousin Nicky",
                "status": "Dead",
                "species": "Alien"
              },
              {
                "id": "77",
                "name": "Cowboy Morty",
                "status": "Alive",
                "species": "Human"
              },
              {
                "id": "78",
                "name": "Cowboy Rick",
                "status": "Alive",
                "species": "Human"
              },
              {
                "id": "79",
                "name": "Crab Spider",
                "status": "Alive",
                "species": "Alien"
              },
              {
                "id": "80",
                "name": "Creepy Little Girl",
                "status": "Alive",
                "species": "Human"
              }
            ]
          }
        }
      },
      "headers": {
        "accept-ranges": "bytes",
        "access-control-allow-credentials": "true",
        "access-control-allow-headers": "*",
        "access-control-allow-methods": "POST, GET, HEAD, OPTIONS",
        "access-control-allow-origin": "*",
        "access-control-expose-headers": "*",
        "access-control-max-age": "600",
        "age": "1",
        "cache-control": "public,s-maxage=900,stale-while-revalidate=900",
        "cache-status": "\"Netlify Edge\"; fwd=method",
        "content-length": "521",
        "content-type": "application/json; charset=utf-8",
        "date": "Sun, 23 Nov 2025 18:59:59 GMT",
        "etag": "W/\"94e-jNL/W9eb6peZbFaFierUEy56PCM\"",
        "expires": "Wed, 26 Nov 2025 18:59:59 GMT",
        "gcdn-cache": "MISS",
        "netlify-vary": "query",
        "server": "Netlify",
        "strict-transport-security": "max-age=31536000",
        "vary": "accept-encoding",
        "x-cache": "MISS",
        "x-cache-hits": "0",
        "x-nf-request-id": "01KAS1CNH870AAK72BQV6J3JKD",
        "x-powered-by": "Stellate",
        "x-served-by": "cache-fra-etou8220179-FRA"
      }
    }
  },
  {
    "request": {
      "method": "POST",
      "url": "https://rickandmortyapi.com/graphql",
      "headers": {
        "Content-Type": "application/json"
      },
      "queryParams": {}
    },
    "response": {
      "status": 200,
      "data": {
        "data": {
          "characters": {
            "results": [
              {
                "id": "141",
                "name": "Ghost in a Jar",
                "status": "Dead",
                "species": "Alien"
              },
              {
                "id": "142",
                "name": "Gibble Snake",
                "status": "Dead",
                "species": "Alien"
              },
              {
                "id": "143",
                "name": "Glasses Morty",
                "status": "Alive",
                "species": "Human"
              },
              {
                "id": "144",
                "name": "Glenn",
                "status": "Dead",
                "species": "Alien"
              },
              {
                "id": "145",
                "name": "Glenn",
                "status": "Alive",
                "species": "Human"
              },
              {
                "id": "146",
                "name": "Glexo Slim Slom",
                "status": "Alive",
                "species": "Alien"
              },
              {
                "id": "147",
                "name": "Gobo",
                "status": "Dead",
                "species": "Alien"
              },
              {
                "id": "148",
                "name": "Goddess Beth",
                "status": "unknown",
                "species": "Mythological Creature"
              },
              {
                "id": "149",
                "name": "Gordon Lunas",
                "status": "Dead",
                "species": "Human"
              },
              {
                "id": "150",
                "name": "Cornvelious Daniel",
                "status": "Dead",
                "species": "Alien"
              },
              {
                "id": "151",
                "name": "Gwendolyn",
                "status": "unknown",
                "species": "Robot"
              },
              {
                "id": "152",
                "name": "Hammerhead Morty",
                "status": "unknown",
                "species": "Humanoid"
              },
              {
                "id": "153",
                "name": "Hamster In Butt",
                "status": "Alive",
                "species": "Animal"
              },
              {
                "id": "154",
                "name": "Hamurai",
                "status": "Dead",
                "species": "Alien"
              },
              {
                "id": "155",
                "name": "Harold",
                "status": "Alive",
                "species": "Cronenberg"
              },
              {
                "id": "156",
                "name": "Hemorrhage",
                "status": "Alive",
                "species": "Human"
              },
              {
                "id": "157",
                "name": "Hole in the Wall Where the Men Can See it All",
                "status": "unknown",
                "species": "unknown"
              },
              {
                "id": "158",
                "name": "Hookah Alien",
                "status": "Alive",
                "species": "Alien"
              },
              {
                "id": "159",
                "name": "Hunter",
                "status": "Dead",
                "species": "Human"
              },
              {
                "id": "160",
                "name": "Hunter's Father",
                "status": "Alive",
                "species": "Human"
              }
            ]
          }
        }
      },
      "headers": {
        "accept-ranges": "bytes",
        "access-control-allow-credentials": "true",
        "access-control-allow-headers": "*",
        "access-control-allow-methods": "POST, GET, HEAD, OPTIONS",
        "access-control-allow-origin": "*",
        "access-control-expose-headers": "*",
        "access-control-max-age": "600",
        "age": "1",
        "cache-control": "public,s-maxage=900,stale-while-revalidate=900",
        "cache-status": "\"Netlify Edge\"; fwd=method",
        "content-length": "591",
        "content-type": "application/json; charset=utf-8",
        "date": "Sun, 23 Nov 2025 19:03:16 GMT",
        "etag": "W/\"976-wvs7Lfb80EjY3mNslD62PmjlHkw\"",
        "expires": "Wed, 26 Nov 2025 19:03:16 GMT",
        "gcdn-cache": "MISS",
        "netlify-vary": "query",
        "server": "Netlify",
        "strict-transport-security": "max-age=31536000",
        "vary": "accept-encoding",
        "x-cache": "MISS",
        "x-cache-hits": "0",
        "x-nf-request-id": "01KAS1JNJ16BAJN2YCCF1GHFTV",
        "x-powered-by": "Stellate",
        "x-served-by": "cache-fra-etou8220179-FRA"
      }
    }
  },
  {
    "request": {
      "method": "GET",
      "url": "https://api.weatherapi.com/v1/current.json",
      "headers": {},
      "queryParams": {
        "key": "6058...1603",
        "q": "London"
      }
    },
    "response": {
      "status": 200,
      "data": {
        "location": {
          "name": "London",
          "region": "City of London, Greater London",
          "country": "United Kingdom",
          "lat": 51.5171,
          "lon": -0.1062,
          "tz_id": "Europe/London",
          "localtime_epoch": 1764269148,
          "localtime": "2025-11-27 18:45"
        },
        "current": {
          "last_updated_epoch": 1764269100,
          "last_updated": "2025-11-27 18:45",
          "temp_c": 14.4,
          "temp_f": 57.9,
          "is_day": 0,
          "condition": {
            "text": "Overcast",
            "icon": "//cdn.weatherapi.com/weather/64x64/night/122.png",
            "code": 1009
          },
          "wind_mph": 13.2,
          "wind_kph": 21.2,
          "wind_degree": 216,
          "wind_dir": "SW",
          "pressure_mb": 1012,
          "pressure_in": 29.88,
          "precip_mm": 0.12,
          "precip_in": 0,
          "humidity": 88,
          "cloud": 100,
          "feelslike_c": 12.8,
          "feelslike_f": 55.1,
          "windchill_c": 10,
          "windchill_f": 50,
          "heatindex_c": 12.2,
          "heatindex_f": 53.9,
          "dewpoint_c": 11.1,
          "dewpoint_f": 51.9,
          "vis_km": 10,
          "vis_miles": 6,
          "uv": 0,
          "gust_mph": 20.2,
          "gust_kph": 32.5
        }
      },
      "headers": {
        "date": "Thu, 27 Nov 2025 18:46:20 GMT",
        "content-type": "application/json",
        "transfer-encoding": "chunked",
        "connection": "keep-alive",
        "server": "BunnyCDN-DE1-864",
        "cdn-pullzone": "93447",
        "cdn-requestcountrycode": "SE",
        "vary": "Accept-Encoding",
        "age": "0",
        "cache-control": "public, max-age=180",
        "via": "1.1 varnish (Varnish/7.1)",
        "x-weatherapi-qpm-left": "999984",
        "x-varnish": "553310330",
        "cdn-proxyver": "1.40",
        "cdn-requestpullsuccess": "True",
        "cdn-requestpullcode": "200",
        "cdn-cachedat": "11/27/2025 18:46:20",
        "cdn-edgestorageid": "865",
        "cdn-requestid": "26b7bc96d3d8c33ef73a40e673abc109",
        "cdn-cache": "EXPIRED",
        "cdn-status": "200",
        "cdn-requesttime": "0"
      }
    }
  }
] as const;

mockData[1].response.data.response[0].league.country