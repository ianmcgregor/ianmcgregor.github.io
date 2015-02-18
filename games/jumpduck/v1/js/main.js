/* main.js */

(function() {

    'use strict';
 
    var STATE_LOAD = 'load',
        STATE_START = 'start',
        STATE_PLAY = 'play',
        STATE_OVER = 'over',
        game,
        width = 768,
        height = 512,
        tileSize = 64,
        levels = 5;

    // loader

    function Load() {
        function preload() {
            game.load.image('hero', 'img/hero.png');
            for (var i = 0; i < levels; i++) {
                var id = ( i + 1 ).toString();
                game.load.tilemap('map0' + id, 'maps/map0' + id + '.json', null, Phaser.Tilemap.TILED_JSON);
            }
            game.load.tileset('tileset', 'img/tiles.png', tileSize, tileSize);
            game.load.audio('jump', ['sfx/jump2.mp3']);
            game.load.audio('die', ['sfx/hit.mp3']);
            game.load.audio('win', ['sfx/tone.mp3']);
        }

        function create() {
            game.input.maxPointers = 1;
            game.stage.scaleMode = Phaser.StageScaleMode.SHOW_ALL;
            game.stage.scale.minWidth = width / 2;
            game.stage.scale.minHeight = height / 2;
            game.stage.scale.maxWidth = width * 2;
            game.stage.scale.maxHeight = height * 2;
            game.stage.scale.forceLandscape = true;
            game.stage.scale.pageAlignHorizontally = true;
            game.stage.scale.setScreenSize(true);
            game.stage.backgroundColor = '#222222';

            game.state.start(STATE_START);
        }

        return {
            'preload': preload,
            'create': create
        };
    }

    // start/gameover screen

    function Screen() {

        function play() {
            game.state.start(STATE_PLAY);
        }

        function create() {
           play();
        }

        return {
            'create': create
        };
    }

    // game play

    function Play() {

        var level = 0,
            tileset,
            floor,
            map,
            layer,
            hero,
            downX = 0,
            downY = 0,
            ducking = false,
            duckedAt = 0,
            velocity = 250,
            jumpSound,
            dieSound,
            winSound,
            doUpdate = false;

        function create() {
            jumpSound = game.add.audio('jump');
            dieSound = game.add.audio('die');
            winSound = game.add.audio('win');

            // tileset
            tileset = game.add.tileset('tileset');
            //console.log(tileset);
            // set all collidable initially
            tileset.setCollisionRange(1, tileset.total - 1, true, true, true, true);
            
            nextLevel();
            // hero
            hero = game.add.sprite(0, 0, 'hero');
            hero.x = 32;
            hero.y = height - floor.height;
            //hero.body.bounce.y = 0.2;
            hero.body.gravity.y = 10;
            hero.body.gravity.x = 0;
            hero.body.collideWorldBounds = true;
           
            hero.anchor.setTo(0.5, 1);
            // camera to follow hero
            game.camera.follow(hero);

            game.input.onDown.add(function(pointer) {
                //console.log('down', pointer.x, pointer.y);
                downX = pointer.x;
                downY = pointer.y;
            });

            game.input.onUp.add(function(pointer) {
                //console.log('up', pointer.x, pointer.y);
                if(hero.body.touching.down && pointer.y < downY - 10) {
                    var distance = downY - pointer.y;
                    if(distance > 50) {
                        distance = 100;
                    }
                    hero.body.velocity.y = -300 - distance;
                    jumpSound.play();
                } else if(pointer.y > downY + 10) {
                    hero.scale.y = 0.5;
                    ducking = true;
                    duckedAt = game.time.now;
                }
            });

            var keyUp = game.input.keyboard.addKey(Phaser.Keyboard.UP);
            keyUp.onDown.add(function() {
                if(hero.body.touching.down) {
                    hero.body.velocity.y = -400;
                    jumpSound.play();
                }
            });
            var keyDown = game.input.keyboard.addKey(Phaser.Keyboard.DOWN);
            keyDown.onDown.add(function() {
                hero.scale.y = 0.5;
                ducking = true;
                duckedAt = game.time.now;
            });
        }

        function update() {
            if(!doUpdate) {
                game.physics.collide(hero, layer);
                game.physics.collide(hero, floor);
                return;
            }
            if(hero.x < 33 && velocity < 0) {
                //hero.x = 32;
                velocity *= -1;
            }
            else if(hero.x > layer.width - 33 && velocity > 0) {
                //hero.x = layer.width - 40;
                velocity *= -1;
            }
            hero.body.velocity.x = velocity;

            // collide the hero with the map
            game.physics.collide(hero, layer, function(h, l) {
                console.log('hit tile:', l.tile.index);
                switch(l.tile.index) {
                    case 2:
                        win();
                        break;
                    case 3:
                        die();
                        break;
                }
            });

            game.physics.collide(hero, floor);

            if(ducking && !hero.body.touching.up && game.time.now - duckedAt > 1000) {
                var tL = map.getTile(layer.getTileX(hero.x - 32), layer.getTileY(hero.y - 96));
                var tR = map.getTile(layer.getTileX(hero.x + 32), layer.getTileY(hero.y - 96));
                if(tL + tR > 0) {
                    return;
                }
                ducking = false;
                hero.scale.y = 1;
            }

            stats.update();

            /*if(hero.y > height - floor.height) {
                hero.y = height - floor.height - 1;
            }*/

            // for replays record hero x, y and scale every frame
        }

        function nextLevel() {
            if(level > 0) {
                clearLevel();
                resetHeroPosition();
            }
            level ++;
            if(level > levels) {
                level = 1;
            }
            map = game.add.tilemap('map0' + level.toString());
            //var layerData = map.layers[0].data;
            var mapWidth = map.layers[0].width * tileset.tileWidth;
            var mapHeight = map.layers[0].height * tileset.tileHeight;
            
            floor = game.add.sprite(0, 0, 'tileset', 1);
            floor.body.immovable = true;
            floor.width = mapWidth;
            floor.height = 128;
            floor.y = height - 128;
            
            layer = game.add.tilemapLayer(0, 0, mapWidth, mapHeight, tileset, map, 0);
            layer.fixedToCamera = false;
            layer.resizeWorld();
            //game.world.setBounds(0, 0, mapWidth, mapHeight - 128);
            doUpdate = true;
        }

        function clearLevel() {
            layer.destroy();
            floor.destroy();
            //hero.destroy();
            //map.destroy();
        }

        function win() {
            winSound.play();
            doUpdate = false;
            setTimeout(nextLevel, 600);
        }

        function die() {
            dieSound.play();
            doUpdate = false;
            setTimeout(function() {
                resetHeroPosition();
                doUpdate = true;
            }, 200);
        }

        function resetHeroPosition() {
            hero.x = 32;
            hero.y = height - floor.height;
        }

        return {
            'create': create,
            'update': update
        };
    }

    // go
    game = new Phaser.Game(width, height, Phaser.AUTO);
    game.state.add(STATE_LOAD, Load);
    game.state.add(STATE_START, Screen);
    game.state.add(STATE_PLAY, Play);
    game.state.add(STATE_OVER, Screen);
    game.state.start(STATE_LOAD);

    var stats = new Stats();
    stats.domElement.style.position = 'absolute';
    document.body.appendChild(stats.domElement);
    stats.begin();
})();