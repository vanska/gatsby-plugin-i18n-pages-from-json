const path = require('path')
const fs = require('fs')

exports.createPages = async ({
  graphql,
  actions: { createPage, createRedirect },
}) => {
  const i18nNamespacesQuery = await graphql(`
    query {
      allI18NNamespaces {
        nodes {
          namespace
          lang
          singleTranslations {
            slug
          }
        }
      }
    }
  `)

  // console.log("i18nNamespacesQuery\n", i18nNamespacesQuery);

  const siteConfigJsonPath = path.resolve('./config/site-config.json')
  const siteConfig = JSON.parse(fs.readFileSync(siteConfigJsonPath))
  // console.log("siteConfig\n", siteConfig);

  const configPages = siteConfig.pages
  const configLanguages = siteConfig.languages
  const defaultLanguage = siteConfig.languages[0]

  const parsedNamespaceDataNodes =
    i18nNamespacesQuery.data.allI18NNamespaces.nodes
  // console.log("configPages\n", configPages);
  // console.log("configLanguages\n", configLanguages);
  // console.log("parsedNamespaceDataNodes\n", parsedNamespaceDataNodes);

  /**
   * @name transformI18nResources
   * @function
   * @description Creates a resource object with all namespaces per language
   * for i18n.init()
   * {
   *   en: {
   *     common: {
   *       slug: "common-slug"
   *     }
   *   },
   *   de: {
   *     common: {
   *       slug: "common-slug"
   *     }
   *   }
   * }
   *
   * We can then find the slug value easily with
   * Object[langKey][namespaceKey].slug
   * @param {Array} languagesArr
   * @param {Array} translationNodes
   * @returns {Object} resourcesObj
   */
  const transformI18nResources = (languagesArr, translationNodes) => {
    let resourcesObj = {}

    languagesArr.forEach((language) => {
      let singleNamespace = {}

      translationNodes.forEach((node) => {
        let currentNode = node

        // Could add "&& currentNode.singleTranslations.slug !== null" to be more strict
        if (currentNode.lang === language) {
          singleNamespace[currentNode.namespace] = {
            slug: currentNode.singleTranslations.slug,
          }
        }
      })

      resourcesObj[language] = singleNamespace
    })

    return resourcesObj
  }
  const i18nResources = transformI18nResources(
    configLanguages,
    parsedNamespaceDataNodes,
  )

  // Check if all translations exist, otherwise return
  // Queries can end up empty when updating local files
  // Todo: Look into createPagesStatefully for more control
  // Related to createParentChildLink() in onCreateNode
  for (let item in i18nResources) {
    if (Object.keys(i18nResources[item]).length === 0) {
      // console.log("Translations from i18nResources are missing. Returning");
      return
    }
  }

  const createAllPages = (pages, languages) => {
    // console.log("createAllPages called with props:\n", "pages:\n", pages, "\nlanguges:\n", languages);

    // Will contain all pages for createPages
    let allPages = []

    // Items for gatsby createRedirect()
    // Handles the javascript side of redirects
    // Should reflect firebase redirects.
    // let allGatsbyRedirects = [
    //   {
    //     fromPath: "/",
    //     toPath: "/en",
    //     isPermanent: true,
    //     redirectInBrowser: true
    //   },
    //   {
    //     fromPath: "/*",
    //     toPath: "/en/404",
    //     statusCode: 404,
    //     redirectInBrowser: true
    //   }
    // ]

    // firebase.json config to redirect all non-language prefixed
    // urls to the default language url.
    // Custom base values from config/firebase-defaults.json
    let allFirebaseRedirects = []
    // Handles hosting rewrites.
    // Should reflect gatsby redirects.
    // Custom base values from config/firebase-defaults.json
    let allFirebaseRewrites = []

    const createFirebaseRedirectRule = (language, page, pagePath) => {
      if (
        language === defaultLanguage &&
        page.name !== 'home' &&
        page.name !== '404'
      ) {
        let pagePathWithoutLanguagePrefix = pagePath.substr(
          defaultLanguage.length + 1,
          pagePath.length,
        )

        let firebaseRedirectRule = {
          source: pagePathWithoutLanguagePrefix,
          destination: `${pagePath}`,
          type: 301,
        }

        allFirebaseRedirects.push(firebaseRedirectRule)
      }
    }

    const createAlternateLinks = (
      allLanguages,
      currentLanguage,
      currentPage,
      parentAltLinks,
    ) => {
      // Parent will not have an array of existing alternateLinks
      if (!Array.isArray(parentAltLinks)) {
        return allLanguages.map((alternateLang) => {
          let alternatePath =
            currentPage.name === 'home'
              ? `/${alternateLang}`
              : `/${alternateLang}/${
                  i18nResources[alternateLang][currentPage.name].slug
                }`

          return {
            path: alternatePath,
            lang: alternateLang,
          }
        })
      }
      // Child items
      if (Array.isArray(parentAltLinks)) {
        // console.log("Parent alt links for:", currentPage.name, currentLanguage, "\n", parentAltLinks)

        return parentAltLinks.map((altLink) => {
          let currentAltLinkLang = altLink.lang
          let childItemPath = `${altLink.path}/${
            i18nResources[currentAltLinkLang][currentPage.name].slug
          }`

          return {
            path: childItemPath,
            lang: currentAltLinkLang,
          }
        })
      }
      // console.log("Page:", page.name, language,"alternateLinksArr:\n", alternateLinksArr)
      // return null
    }

    languages.forEach((language) => {
      pages.forEach((page) => {
        // console.log(language, page);

        let pagePath =
          page.name === 'home'
            ? `/${language}`
            : `/${language}/${i18nResources[language][page.name].slug}`

        createFirebaseRedirectRule(language, page, pagePath)

        const getMetaRobots = (page) => page.metaRobots && page.metaRobots

        // Remove undefined slugs from the object
        const removeUndefinedProperties = (obj) =>
          Object.entries(obj).reduce(
            (a, [k, v]) => (v ? { ...a, [k]: v } : a),
            {},
          )

        const createPageObj = (
          slug,
          component,
          language,
          namespaces,
          altLinks,
          page,
        ) => ({
          path: slug,
          component: path.resolve(component),
          context: {
            lang: language,
            namespaces: namespaces,
            alternateLinks: altLinks,
            metaRobots: getMetaRobots(page),
          },
        })

        // console.log("Page:", page.name, language,"alternateLinksArr:\n", alternateLinksArr)

        let parentAlternateLinks = createAlternateLinks(
          languages,
          language,
          page,
          null,
        )

        let pageObj = createPageObj(
          pagePath,
          page.component,
          language,
          page.namespaces,
          parentAlternateLinks,
          page,
        )

        // Match path for home page
        // if (pageObj.path === `/${defaultLanguage}`) {
        //   pageObj.matchPath = `/`
        // }

        if (process.env.NODE_ENV === 'development') {
          // Add matchPath for 404 pages
          // Otherwise will throw an error on develop environment.
          // Redirects for the build will be handled by firebase.
          let defaultLanguage404Path = `/${defaultLanguage}/404`
          if (pageObj.path === defaultLanguage404Path) {
            // console.log(`Adding matchPath for ${defaultLanguage404Path}`);
            pageObj.matchPath = `/*`
          }
          if (
            pageObj.path.match(/^\/[a-z]{2}\/404$/) &&
            pageObj.path !== defaultLanguage404Path
          ) {
            pageObj.matchPath = `/${language}/*`
          }
        }

        // console.log("Pushing parent alternateLinks:", page.name, language, "\n", pageObj.context.alternateLinks) // Parent objects alternateLinks

        // console.log("Pushing page object:\n", page.name, language, "\n", pageObj.context.alternateLinks);

        allPages.push(removeUndefinedProperties(pageObj))

        if (Array.isArray(page.children)) {
          const getChildItems = (page, parentSlug, parentAltLinks) => {
            // console.log(language, page.name, "has", page.children.length, "children:\n", page.children);

            // console.log(parentAltLinks);

            page.children.forEach((item) => {
              let itemPath = `${parentSlug}/${
                i18nResources[language][item.name].slug
              }`

              createFirebaseRedirectRule(language, item, itemPath)

              // console.log("Child Page item:", item.name, language,"childItemAlternateLinksArr:\n", childItemAlternateLinksArr)

              let childAlternateLinks = createAlternateLinks(
                languages,
                language,
                item,
                parentAltLinks,
              )

              // console.log("childAlternateLinks", languages, language, item, parentAltLinks);

              let itemObj = createPageObj(
                itemPath,
                item.component,
                language,
                item.namespaces,
                childAlternateLinks,
                item,
              )

              // console.log("Pushing child alternateLinks", item.name, language, "\n", itemObj.context.alternateLinks);

              allPages.push(removeUndefinedProperties(itemObj))

              // Recursion here
              if (Array.isArray(item.children)) {
                getChildItems(item, itemPath, childAlternateLinks)
              }
            })
          }

          getChildItems(page, pagePath, parentAlternateLinks)
        }
      })

      // let gatsbyRedirect = {
      //   fromPath: `/${language}/**`,
      //   toPath: `/${language}/404`,
      //   statusCode: 404,
      //   redirectInBrowser: true
      // }

      let firebaseRewrite = {
        source: `/${language}/**`,
        destination: `/${language}/404/index.html`,
      }

      // allGatsbyRedirects.push(gatsbyRedirect)
      allFirebaseRewrites.push(firebaseRewrite)
    })

    // Only needed for plugins like getsby-netlify.
    // Left in case hosting needs to be changed.
    // Could be used to create plugin for firebase redirects.
    // Access created object from onPostBuild Gatsby hook.
    // allGatsbyRedirects.forEach((redirect) => {
    //   console.log("allGatsbyRedirects redirect \n", redirect)
    //   createRedirect(redirect)
    // })

    if (siteConfig.generateFirebaseHostingRules) {
      const firebaseJsonDefaultsPath = path.resolve(
        './config/firebase-defaults.json',
      )
      const firebaseJsonPath = path.resolve('./firebase.json')
      const firebaseDefaults = JSON.parse(
        fs.readFileSync(firebaseJsonDefaultsPath),
      )

      // Copy the default values and add to the beginning of the array
      firebaseDefaults.hosting.redirects.forEach((redirect, i) => {
        allFirebaseRedirects.splice(i, 0, redirect)
      })

      firebaseDefaults.hosting.rewrites.forEach((rewrite, i) => {
        allFirebaseRewrites.splice(i, 0, rewrite)
      })

      // Copy the json data
      let newFirebaseJson = {
        ...firebaseDefaults,
      }

      newFirebaseJson.hosting.redirects.length = 0 // Clear old array data
      newFirebaseJson.hosting.rewrites.length = 0 // Clear old array data

      newFirebaseJson.hosting.redirects = allFirebaseRedirects // Assign new items
      newFirebaseJson.hosting.rewrites = allFirebaseRewrites // Assign new items

      // console.log(newFirebaseJson);

      fs.writeFileSync(
        firebaseJsonPath,
        JSON.stringify(newFirebaseJson, null, 2),
      )
    }

    // console.log("allPages[]", allPages)
    allPages.forEach((page) => {
      createPage(page)
    })
  }

  createAllPages(configPages, configLanguages)
}
