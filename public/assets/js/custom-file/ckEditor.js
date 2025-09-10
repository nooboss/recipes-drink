var KTAppCKEditorInit = (function () {

    // Initialize CKEditor on specified textareas
    const initCkEditors = () => {
      const textareas = ['kt_docs_first_ckeditor_classic', 'kt_docs_second_ckeditor_classic']; // IDs of the textareas
  
      textareas.forEach(textarea => {
        const editorElement = document.querySelector(`#${textarea}`);
        if (editorElement) {
          ClassicEditor
            .create(editorElement, {
              toolbar: {
                items: [
                  'undo', 'redo', '|',
                  'heading', '|',
                  'bold', 'italic', '|',
                  'link', '|',
                  'bulletedList', 'numberedList', '|',
                ]
              },
              language: 'en',
          
              heading: {
                options: [
                  { model: 'paragraph', title: 'Paragraph', class: 'ck-heading_paragraph' },
                  { model: 'heading1', view: 'h1', title: 'Heading 1', class: 'ck-heading_heading1' },
                  { model: 'heading2', view: 'h2', title: 'Heading 2', class: 'ck-heading_heading2' },
                  { model: 'heading3', view: 'h3', title: 'Heading 3', class: 'ck-heading_heading3' },
                  { model: 'heading4', view: 'h4', title: 'Heading 4', class: 'ck-heading_heading4' },
                  { model: 'heading5', view: 'h5', title: 'Heading 5', class: 'ck-heading_heading5' },
                  { model: 'heading6', view: 'h6', title: 'Heading 6', class: 'ck-heading_heading6' }
                ]
              }
            })
            .then(editor => {
          
            })
            .catch(error => {
              console.error(`Error initializing ${textarea} editor`, error);
            });
        }
      });
    }

    // Publicly accessible method to initialize the module
    return {
      init: function () {
        initCkEditors();
      }
    };
})();

// On document ready
KTUtil.onDOMContentLoaded(function () {
  KTAppCKEditorInit.init();
});
