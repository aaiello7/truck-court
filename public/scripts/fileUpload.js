$(document).ready(function() {
  // input plugin
  bsCustomFileInput.init();

  // get file and preview image
  $("#inputGroupFile").on('change', function() {
    let input = $(this)[0];
    if (input.files && input.files[0]) {
      let reader = new FileReader();
      reader.onload = function(e) {
        const logoURL = e.target.result;
        $('#preview').attr('src', logoURL).fadeIn('slow');
      };
      reader.readAsDataURL(input.files[0]);
    };
  });
});