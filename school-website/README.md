# Petite Fleur Montessori School website

This is a standalone static website. Open `index.html` to preview it locally.

## Pages

- `index.html` is the home page.
- `about.html` introduces the school's Montessori approach.
- `learning.html` describes Montessori learning areas.
- `visit.html` has the visit enquiry form.

## School contact

- Location: Teshie, Ghana.
- Phone: 024 948 6353 or 053 038 2899.
- Email: apedotheo345@gmail.com.

Before publishing, confirm the school has permission to publish the pupil photos and check the school description and learning information.

The enquiry form creates an email draft and does not store or send information on its own.

## GitHub Pages

The workflow in `../.github/workflows/deploy-school-site.yml` publishes only this folder. In the GitHub repository, set **Settings > Pages > Build and deployment > Source** to **GitHub Actions**. Push the site and workflow files to `main`; the workflow will publish them and show the live URL in its deployment summary.

The repository owner must be signed in and have permission to change Pages settings and push to the repository. No repository changes are published by opening the local preview.