var can = document.querySelector('canvas');
var ctx = can.getContext('2d');
let x = 0;
let y = 0;
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
