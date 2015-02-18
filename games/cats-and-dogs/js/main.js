/* main.js */

(function() {

    'use strict';
 
    var STATE_LOAD = 'load',
        STATE_START = 'start',
        STATE_PLAY = 'play',
        STATE_OVER = 'over',
        game,
        width = 800,
        height = 480,
        firstLevel = 0,
        levels = [
            {
                id: 'level1',
                startX: 128,
                startY: 100
            },
            {
                id: 'boss1',
                startX: 500,
                startY: 0
            }
        ];

    // loader

    function Load() {
        function preload() {
            game.load.tilemap('level1', 'assets/level1.json', null, Phaser.Tilemap.TILED_JSON);
            game.load.tilemap('boss1', 'assets/boss1.json', null, Phaser.Tilemap.TILED_JSON);
            game.load.tileset('tileset', 'assets/tiles.png', 64, 64);
            game.load.atlasJSONHash('entities', 'assets/entities.png', 'assets/entities.json');
            //this.load.audio('music', ['audio/main_menu.mp3']);
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
            game.stage.backgroundColor = '#7a94ff';

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
            var style = 2,
                titleTexture,
                btnTexture,
                title,
                playButton;

            titleTexture = (game.state.current === 'start' ? 'title' : 'gameover') + style;
            btnTexture = 'play' + style;
            //music = this.add.audio('titleMusic');
            //music.play();
            title = game.add.sprite(400, 160, 'entities', titleTexture);
            title.anchor.x = 0.5;
            
            playButton = game.add.button(400, 300, 'entities', play, null, btnTexture, btnTexture, btnTexture);
            playButton.anchor.x = 0.5;
        }

        return {
            'create': create
        };
    }

    // game play

    function Play() {

        var mapWidth,
            mapHeight,
            hud,
            levelContainer,
            tileset,
            layer,
            layerData,
            hero,
            cursors,
            fishes,
            score = 0,
            gun,
            heroHasGun = false,
            bullets,
            enemies,
            enemyAddedAt = 0,
            enemyVelocity = 100,
            heroHealthMax = 10,
            heroHealth,
            shotAt = 0,
            hurtAt = 0,
            hurtNext = 500,
            exploder,
            level,
            jumpedAt = 0,
            paw,
            pawTween,
            pawHealth = 5,
            controls;

        function create() {
            // init
            heroHealth = heroHealthMax;
            heroHasGun = false;
            pawHealth = 5;
            // tileset
            tileset = game.add.tileset('tileset');
            // set all collidable initially
            tileset.setCollisionRange(0, tileset.total - 1, true, true, true, true);
            // water
            tileset.setCollisionRange(5, 7, false, false, false, false);
            tileset.setCollisionRange(9, 11, false, false, false, false);
            //  one-way
            tileset.setCollision(15, true, false, false, false);
            
            // level map
            levelContainer = game.add.group();
            level = levels[firstLevel];
            addTileMap(level.id);

            // fish
            fishes = game.add.group();
            for(var i = 0; i < layerData.length; i++) {
                for(var j = 0; j < layerData[i].length; j++) {
                    if(layerData[i][j] === 11 && Math.random() > 0.4) {
                        var fish = fishes.create(j * 64, i * 64, 'entities', 'fish');
                        fish.body.gravity.y = 8;
                    }
                }
            }

            // hero
            hero = game.add.sprite(width / 2, 0, 'entities', 'hero_1');
            //hero.body.setSize(48, 40, 8, 20);
            hero.body.bounce.y = 0.2;
            hero.body.gravity.y = 10;
            hero.body.gravity.x = 0;
            hero.body.collideWorldBounds = false;
            hero.events.onOutOfBounds.add(function(hero) {
                //hero.kill();
                if(hero.y < 0) {
                    return;
                }
                heroHealth--;
                restart();
            });
            hero.anchor.setTo(0.5, 0.5);
            hero.animations.add('walk', ['hero_1', 'hero_2'], 8, true);
            // camera to follow hero
            game.camera.follow(hero);
            
            // gun
            gun = game.add.sprite(3800, 50, 'entities', 'gun');
            gun.anchor.setTo(0.5, 1);
            bullets = game.add.group();

            // enemies
            enemies = game.add.group();

            // explosion
            exploder = game.add.emitter(0, 0, 100);
            exploder.makeParticles('entities', 'blood');

            // controls
            game.input.keyboard.addKeyCapture([ Phaser.Keyboard.LEFT, Phaser.Keyboard.RIGHT, Phaser.Keyboard.UP, Phaser.Keyboard.DOWN, Phaser.Keyboard.SPACEBAR ]);
            cursors = game.input.keyboard.createCursorKeys();

            // hud
            hud = new HUD();

            // controls
            controls = new Controls();
        }

        function update() {
            // hud
            hud.update();
            controls.update();
            
            // collide the hero with the map
            game.physics.collide(hero, layer, function(h, t) {
                //console.log('t', t);
                switch(t.tile.index) {
                    //case 1:
                    //    restart();
                    //    break;
                    case 1:
                    case 2:
                        nextLevel();
                        break;
                }
            });

            // enemies
            if(enemies.length > 0) {
                game.physics.collide(enemies, layer);
                game.physics.collide(hero, enemies, function(h, e) {
                    var landedOnHead = h.body.touching.down && e.body.touching.up;
                    if(landedOnHead) {
                        killEnemy(e);
                    }
                    else if(game.time.now - hurtAt > hurtNext) {
                        heroHealth --;
                        var sign = e.x - h.x > 0 ? -1 : 1;
                        h.body.velocity.x = 1000 * sign;
                        if(h.body.touching.down) {
                            h.body.velocity.y = -200;
                        }
                        hurtAt = game.time.now;
                    }
                });

                enemies.forEach(function(enemy) {
                    if(enemy.body.velocity.x === 0 && enemy.body.touching.down) {
                        enemy.body.velocity.x = enemy.x < hero.x ? enemyVelocity : -enemyVelocity;
                        enemy.scale.x = enemy.body.velocity.x > 0 ? 1 : -1;
                        enemy.animations.play('walk');
                    }
                    if(enemy.body.velocity.y < 1 && enemy.body.touching.down && ( enemy.body.touching.left || enemy.body.touching.right ) ) {
                        enemy.body.velocity.y = -200 + Math.random() * 200;
                        enemy.body.velocity.x = enemy.scale.x > 0 ? enemyVelocity : -enemyVelocity;
                    }
                });

                if(bullets.length > 0) {
                    game.physics.collide(bullets, enemies, function(bullet, enemy) {
                        bullet.kill();
                        killEnemy(enemy);
                    });
                }
            }

            // fishes
            fishes.forEach(function(fish) {
                fish.body.velocity.x = 0;
                if(fish.y > 640) {
                    fish.body.velocity.y = -600 + ( -100 * Math.random() );
                }
            });
            game.physics.collide(fishes, hero);

            // hero movement
            hero.body.velocity.x = 0;

            if (controls.left() || cursors.left.isDown) {
                hero.body.velocity.x = -150;
                hero.scale.x = -1;
            }
            else if (controls.right() || cursors.right.isDown) {
                hero.body.velocity.x = 150;
                hero.scale.x = 1;
            }
            //  jump
            var jumping = controls.jump() || cursors.up.isDown;
            if (jumping && hero.body.touching.down) {
                hero.body.velocity.y = -300;
                jumpedAt = game.time.now;
                //console.log('x is ', hero.x);
            }
            else if (jumping && hero.body.velocity.y < 0 && hero.body.velocity.y > -600 && game.time.now - jumpedAt < 200) {
                hero.body.velocity.y = hero.body.velocity.y - 40;
            }
            // animation
            if(Math.abs(hero.body.velocity.x) > 0 && hero.body.touching.down) {
                hero.animations.play('walk');
            }
            else {
                hero.animations.stop(); 
                hero.frameName = 'hero_1';
            }
            
            // get gun
            game.physics.overlap(hero, gun, function() {
                heroHasGun = true;
            });

            // shoot
            if(heroHasGun) {
                gun.x = hero.x;
                if(hero.scale.x < 0) {
                    gun.x -= 32;
                }
                gun.y = hero.y;
                gun.scale.x = hero.scale.x;

                if(game.input.keyboard.isDown(Phaser.Keyboard.SPACEBAR) && game.time.now - shotAt > 200 ) {
                    var b = bullets.create(hero.scale.x > 0 ? gun.x + 36 : gun.x - 36, gun.y - 40, 'entities', 'bullet');
                    b.body.velocity.x = hero.scale.x > 0 ? 600 : -600;
                    b.events.onOutOfBounds.add(function(bullet) {
                        bullet.kill();
                    });
                    shotAt = game.time.now;
                }
            }

            // update level
            updateLevel();

            if(heroHealth <= 0) {
                clearLevel();
                game.camera.follow(null);
                game.state.start(STATE_OVER);
            }
        }

        function updateLevel() {
           switch(level.id) {
                case 'level1':
                     if(Math.random() > 0.5 && enemies.length < 25 && game.time.now - enemyAddedAt > 3000) {
                        addEnemy();
                        enemyAddedAt = game.time.now;
                    }
                    break;
                case 'boss1':
                    if(!paw) {
                        paw = game.add.sprite(mapWidth, mapHeight, 'entities', 'paw');
                        paw.body.gravity.x = 0;
                        paw.body.gravity.y = 0;
                        paw.body.collideWorldBounds = false;
                    }
                    paw.body.velocity.x = paw.body.velocity.y = 0;
                    //console.log(paw.x, mapWidth);
                    //if(paw.x === mapWidth && Math.random() > 0.9) {
                    /*if(pawHealth <= 0 && ) {
                       paw.kill(); 
                    }
                    else*/ 
                    if(!pawTween || !pawTween.isRunning) {
                        if(pawTween) {
                            pawTween.stop();
                        }
                        //paw.y = mapHeight - 420 + Math.random() * 200;
                        paw.y = paw.fixedY = mapHeight - 200;
                        var xVel = 1000 + Math.random() * 1000;
                        var delay = 0;
                        if(paw.x > mapWidth - 10) {
                            xVel *= -1;
                            delay = Math.random() * 1000;
                        } else {
                            xVel += 1000;
                        }
                        pawTween = game.add.tween(paw.body.velocity);
                        pawTween
                            .to({x: xVel}, 1000)
                            .delay(delay)
                            .onComplete.add(function() {
                                console.log('onPawComplete');
                            });
                        pawTween.start();
                    }
                    game.physics.collide(hero, paw, function(h, p) {
                        var landedOnHead = h.body.touching.down && p.body.touching.up;
                        if(landedOnHead) {
                            console.log('hurt paw');
                            h.body.velocity.y = -200;
                            pawTween.stop();
                            pawHealth--;
                        }
                        else if(game.time.now - hurtAt > hurtNext) {
                            console.log('hurt hero');
                            heroHealth --;
                            hurtAt = game.time.now;
                            h.body.velocity.x = -200;
                            h.body.velocity.y = -200;
                        }
                    });
                    if(paw.x > mapWidth) {
                        paw.x = mapWidth;
                        paw.body.velocity.x = 0;
                    }
                    if(paw.x < 0) {
                        paw.x = 0;
                        paw.body.velocity.x = 800;
                    } 
                    paw.y = paw.fixedY || mapHeight;
                    break;
           }
        }

        function addEnemy() {
            //console.log('addEnemy', game.camera);
            var enemyType = Math.random() < 0.5 ? 'dog' : 'cat';
            var enemy = enemies.create(game.camera.x + ( game.camera.view.width * Math.random()), 0 - 64, 'entities', enemyType + '_1');
            enemy.body.bounce.y = 0.2;
            enemy.body.gravity.y = 8;
            enemy.body.gravity.x = 0;
            enemy.anchor.setTo(0.5, 0.5);
            enemy.animations.add('walk', [enemyType + '_1', enemyType + '_2'], 3, true);
            enemy.body.collideWorldBounds = false;
            enemy.events.onOutOfBounds.add(function(e) {
                if(e.y > 0) {
                    e.kill();
                }
            });
        }

        function killEnemy(e) {
            exploder.x = e.x;
            exploder.y = e.y;
            exploder.start(true, 500, null, 20);
            e.kill();
            score += 100;
        }

        function addTileMap(level) {
            var map = game.add.tilemap(level);
            layerData = map.layers[0].data;
            mapWidth = map.layers[0].width * tileset.tileWidth;
            mapHeight = map.layers[0].height * tileset.tileHeight;
            layer = new Phaser.TilemapLayer(game, 0, 0, mapWidth, mapHeight, tileset, map, 0);
            //layer = game.add.tilemapLayer(0, 0, mapWidth, mapHeight, tileset, map, 0);
            layer.fixedToCamera = false;
            levelContainer.add(layer);
            layer.resizeWorld();
        }

        function restart() {
            console.log('RESTART');
            hero.x = level.startX;
            hero.y = level.startY;
            game.camera.x = 0;
            game.camera.y = 0;
        }

        function clearLevel() {
            if(layer) {
                layer.kill();
            }
            fishes.removeAll();
            enemies.removeAll();
            game.camera.x = 0;
            game.camera.y = 0;
        }

        function nextLevel() {
            console.log('NEXT LEVEL');
            var i = levels.indexOf(level);
            i++;
            if(i > levels.length - 1) {
                i = 0;
            }
            level = levels[i];

            clearLevel();

            addTileMap(level.id);

            restart();
        }

        function HUD() {
            var container,
                scoreText,
                hudScore = 0,
                hudHealth = heroHealthMax;

            function padZeros(value) {
                value = value.toString();
                while(value.length < 6) {
                    value = '0' + value;
                }
                return value;
            }

            container = game.add.group();
            container.x = container.y = 16;
            //container.fixedToCamera = true;

            scoreText = new Phaser.Text(game, 0, 0, padZeros(0), { font: 'bold 12pt Arial', fill: '#fff' });
            container.add(scoreText);

            var hearts = [];
            var lives = game.add.group(container);
            lives.x = 550;
            for (var i = 0; i < 10; i++) {
                hearts[i] = lives.add(new Phaser.Sprite(game, i * 22, 0, 'entities', 'heart'));
            }

            return {
                update: function() {
                    container.x = game.camera.x + 16;
                    container.y = game.camera.y + 16;

                    if(score !== hudScore) {
                        scoreText.content = padZeros(score);
                        hudScore = score;
                    }
                    
                    if(heroHealth !== hudHealth) {
                        for (var i = heroHealthMax - 1; i > heroHealth - 1; i--) {
                            hearts[i].frameName = 'heart_empty';
                        }
                    }
                }
            };
        }

        return {
            'create': create,
            'update': update
        };
    }

    function Controls() {
        var container,
            btnLeft,
            btnRight,
            btnJump,
            btnShoot,
            leftDown = false,
            rightDown = false,
            jumpDown = false,
            shootDown = false;

        container = game.add.group();
        container.x = container.y = 0;

        btnLeft = new Phaser.Button(game, 20, 370, 'entities', null, null, 'btn_up', 'btn_up', 'btn_down');
        container.add(btnLeft);
        btnLeft.onInputDown.add(function() {
            leftDown = true;
        });
        btnLeft.onInputUp.add(function() {
            leftDown = false;
        });

        btnRight = new Phaser.Button(game, 220, btnLeft.y, 'entities', null, null, 'btn_up', 'btn_up', 'btn_down');
        btnRight.scale.x = -1;
        container.add(btnRight);
        btnRight.onInputDown.add(function() {
            rightDown = true;
        });
        btnRight.onInputUp.add(function() {
            rightDown = false;
        });

        btnJump = new Phaser.Button(game, 780, btnLeft.y, 'entities', null, null, 'btn_up', 'btn_up', 'btn_down');
        btnJump.rotation = Math.PI * 0.5;
        container.add(btnJump);
        btnJump.onInputDown.add(function() {
            jumpDown = true;
        });
        btnJump.onInputUp.add(function() {
            jumpDown = false;
        });

        return {
            update: function() {
                container.x = game.camera.x;
                container.y = game.camera.y;
            },
            left: function() {
                return leftDown;
            },
            right: function() {
                return rightDown;
            },
            jump: function() {
                return jumpDown;
            }
        };
    }

    // go
    game = new Phaser.Game(width, height, Phaser.AUTO);
    game.state.add(STATE_LOAD, Load);
    game.state.add(STATE_START, Screen);
    game.state.add(STATE_PLAY, Play);
    game.state.add(STATE_OVER, Screen);
    game.state.start(STATE_LOAD);

})();