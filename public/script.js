var can = document.querySelector('canvas');
var ctx = can.getContext('2d');
let x = 0;
let y = 0;

// MOUSE
function position(e){
    x = e.offsetX;
    y = e.offsetY;
}
can.addEventListener('mousedown', function(e){
    position(e);
});
can.addEventListener('mouseenter', function(e){
    position(e);
});
can.addEventListener('mousemove', function(e){
    if (e.buttons !== 1) return;
    ctx.beginPath();

    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'black';

    ctx.moveTo(x, y);
    position(e);
    ctx.lineTo(x, y);

    ctx.stroke();
});


can.addEventListener('mouseup', function() {
    $("#sig").val(can.toDataURL());
});

// TOUCH
function touchPosition(e){
    x = e.touches[0].pageX - can.offsetLeft;
    y = e.touches[0].pageY - can.offsetTop;
}
can.addEventListener('touchstart', function(e){
    e.preventDefault();
    touchPosition(e);
    // console.log(x, y);
});
can.addEventListener('touchmove', function(e){
    e.preventDefault();
    // console.log(e);
    ctx.beginPath();

    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'black';

    ctx.moveTo(x, y);
    touchPosition(e);
    ctx.lineTo(x, y);

    ctx.stroke();
});


can.addEventListener('touchend', function() {
    $("#sig").val(can.toDataURL());
});

var clearButton = document.getElementById('clear');
clearButton.addEventListener('click', function(){
    ctx.clearRect(0, 0, can.width, can.height);
    document.getElementById('sig').value = '';
});
