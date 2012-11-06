
## db.components

  - `name` the name of the component
  - `repo` the github name of the component repository

  - `description` component description
  - `version` component version
  - `pck` package component (stringiied)

  - `fork` github component forks
  - `star` github component stars
  - `gh` github repo properties of the component via gh API 3.x (stringiied)

  - `twitted` component twitted status
      - 'zero': 'ready to twitter'
      - 'stacked': 'into the twtting stack'
      - 'twitted': 'it already has been twitted'
      - 're-send': 'ready to twitte again'
      - 'failed': 'twitting process failed'
      - 'waiting': 'the twitt can be emitted. Waiting for soma change'

  - `gh_status` component github repo status -> |200|404|
