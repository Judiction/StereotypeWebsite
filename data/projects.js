// objetos no formato JSON que guardam todos os projetos do site.
// a ideia é que vocë possa apenas atualizar esse arquivo, adicionando um projeto
// e nossos scripts fazem o resto do trabalho!


export const works = {
    "project-slug-01":{
        year: 2026,
        categories: ["3d", "interactive"],
        thumbnail: "https://res.cloudinary.com/dr5dbkh91/video/upload/f_auto,q_auto,w_800,so_0/v1770302765/projects/tap-to-pay-zoop/y1droueioptnwkagby0j.jpg", // colocar
        preview: "https://res.cloudinary.com/dr5dbkh91/video/upload/f_auto,q_auto,w_800/v1770302765/projects/tap-to-pay-zoop/y1droueioptnwkagby0j.mp4", // colocar
        title: {
            en: "Project Title",
            pt: "Título do Projeto",
            fr: "Titre du Projet"
        },
        credits: {
            agency: "NOO",
            direction: "Marcio Sal",
            programming: "Judd Buchannan"
        },
        content: [
            {
                type: "video",
                url: "https://youtube.com/embed/NOVLNrncpYw",
                caption: {
                    pt: "Entrega principal",
                    en: "Main deliverable",
                    fr: "Livrable principal"
                }
            },
            {
                type: "text",
                text: {
                    pt: "A Zoop precisava apresentar o Tap to Pay como uma soluÃ§Ã£o moderna...",
                    en: "Zoop needed to present Tap to Pay as a modern payment solution...",
                    fr: "Zoop devait prÃ©senter le Tap to Pay comme une solution moderne..."
                }
            },
            {
                type: "image",
                url: "https://res.cloudinary.com/dr5dbkh91/image/upload/f_auto,q_auto/v1770302664/projects/tap-to-pay-zoop/ifnqtscoz8nadanqrjhd.png",
                caption: { "pt": null, "en": null, "fr": null }
            }
            ]
    },
    "project-slug-02":{
        year: 2025,
        categories: ["interactive", "animation"],
        thumbnail: "https://res.cloudinary.com/dobmgp6ug/video/upload/f_auto,q_auto,w_800,so_0/v1770339433/Preview_Google_x0igus.jpg", // colocar
        preview: "https://res.cloudinary.com/dobmgp6ug/video/upload/f_auto,q_auto,w_800/v1770339433/Preview_Google_x0igus.mp4", // colocar
        title: {
            en: "Project Title 2",
            pt: "Título do Projeto 2",
            fr: "Titre du Projet 2"
        },
        credits: {
            agency: "NOO",
            direction: "Fernando Villela",
            programming: "Judd Buchannan"
        },
        content: [
            {
                type: "video",
                url: "https://youtube.com/embed/NOVLNrncpYw",
                caption: {
                    pt: "Entrega principal",
                    en: "Main deliverable",
                    fr: "Livrable principal"
                }
            },
            {
                type: "text",
                text: {
                    pt: "A Coca-cola precisava apresentar o Tap to Pay como uma soluÃ§Ã£o moderna...",
                    en: "Coca-cola needed to present Tap to Pay as a modern payment solution...",
                    fr: "Coca-cola devait prÃ©senter le Tap to Pay comme une solution moderne..."
                }
            },
            {
                type: "image",
                url: "https://res.cloudinary.com/dobmgp6ug/image/upload/f_auto,q_auto,so_0/v1772135204/Glued_On_The_Wall_Street_Posters_Mockup_2_va0boq.jpg",
                caption: { "pt": null, "en": null, "fr": null }
            },
            {
                type: "text",
                text: {
                    pt: "A Coca-cola precisava apresentar o Tap to Pay como uma soluÃ§Ã£o moderna...",
                    en: "Coca-cola needed to present Tap to Pay as a modern payment solution...",
                    fr: "Coca-cola devait prÃ©senter le Tap to Pay comme une solution moderne..."
                }
            },
            ]
    },
    "project-slug-03":{
        year: 2024,
        categories: ["3d"],
        thumbnail: "https://res.cloudinary.com/dobmgp6ug/video/upload/f_auto,q_auto,w_800,so_0/v1770662860/HAIRSPRAY_PREVIEW_s5kud2.jpg", // colocar
        preview: "https://res.cloudinary.com/dobmgp6ug/video/upload/f_auto,q_auto,w_800/v1770662860/HAIRSPRAY_PREVIEW_s5kud2.mp4", // colocar
        title: {
            en: "Project Title 3",
            pt: "Título do Projeto 3",
            fr: "Titre du Projet 3"
        },
        credits: {
            agency: "NOO",
            direction: "Marcio Sal",
            programming: "Judd Buchannan"
        },
        content: [
            {
                type: "video",
                url: "https://youtube.com/embed/NOVLNrncpYw",
                caption: {
                    pt: "Entrega principal",
                    en: "Main deliverable",
                    fr: "Livrable principal"
                }
            },
            {
                type: "text",
                text: {
                    pt: "A Zoop precisava apresentar o Tap to Pay como uma soluÃ§Ã£o moderna...",
                    en: "Zoop needed to present Tap to Pay as a modern payment solution...",
                    fr: "Zoop devait prÃ©senter le Tap to Pay comme une solution moderne..."
                }
            },
            {
                type: "image",
                url: "https://res.cloudinary.com/dr5dbkh91/image/upload/f_auto,q_auto/v1770302664/projects/tap-to-pay-zoop/ifnqtscoz8nadanqrjhd.png",
                caption: { "pt": null, "en": null, "fr": null }
            }
            ]
    },

    "project-slug-04":{
        year: 2026,
        categories: ["animation"],
        thumbnail: "https://res.cloudinary.com/dobmgp6ug/video/upload/f_auto,q_auto,w_800,so_0/v1770769166/KIMURA_PREVIEW_hcy3wk.jpg", // colocar
        preview: "https://res.cloudinary.com/dobmgp6ug/video/upload/f_auto,q_auto,w_800/v1770769166/KIMURA_PREVIEW_hcy3wk.mp4", // colocar
        title: {
            en: "Project Title 4",
            pt: "Título do Projeto 4",
            fr: "Titre du Projet 4"
        },
        credits: {
            agency: "NOO",
            direction: "Fernando Villela",
            programming: "Judd Buchannan"
        },
        content: [
            {
                type: "video",
                url: "https://youtube.com/embed/NOVLNrncpYw",
                caption: {
                    pt: "Entrega principal",
                    en: "Main deliverable",
                    fr: "Livrable principal"
                }
            },
            {
                type: "text",
                text: {
                    pt: "A Coca-cola precisava apresentar o Tap to Pay como uma soluÃ§Ã£o moderna...",
                    en: "Coca-cola needed to present Tap to Pay as a modern payment solution...",
                    fr: "Coca-cola devait prÃ©senter le Tap to Pay comme une solution moderne..."
                }
            },
            {
                type: "image",
                url: "https://res.cloudinary.com/dobmgp6ug/image/upload/f_auto,q_auto,so_0/v1772135204/Glued_On_The_Wall_Street_Posters_Mockup_2_va0boq.jpg",
                caption: { "pt": null, "en": null, "fr": null }
            },
            {
                type: "text",
                text: {
                    pt: "A Coca-cola precisava apresentar o Tap to Pay como uma soluÃ§Ã£o moderna...",
                    en: "Coca-cola needed to present Tap to Pay as a modern payment solution...",
                    fr: "Coca-cola devait prÃ©senter le Tap to Pay comme une solution moderne..."
                }
            },
            ]
    },
}

export const digitalArt = {
    "digital-soup":{
        year: 2026,
        categories: ["3d", "interactive"],
        thumbnail: "https://cache.teia.rocks/ipfs/QmdGstLkW8qNTs8vMqtntLGPi7o7bqzWYvfgAyQiZDzgyJ", // colocar
        preview: "https://cache.teia.rocks/ipfs/QmWLZzso37zsvpRZ1ZvCKFxM6MwyUJMycqmYMHDhkGqERU", // colocar
        title: {
            en: "Digital Soup",
            pt: "Digital Soup",
            fr: "Digital Soup"
        },
        credits: {
            agency: "NOO",
            direction: "Marcio Sal",
            programming: "Judd Buchannan"
        },
        content: [
            {
                type: "video",
                url: "https://youtube.com/embed/NOVLNrncpYw",
                caption: {
                    pt: "Entrega principal",
                    en: "Main deliverable",
                    fr: "Livrable principal"
                }
            },
            {
                type: "text",
                text: {
                    pt: "A Zoop precisava apresentar o Tap to Pay como uma soluÃ§Ã£o moderna...",
                    en: "Zoop needed to present Tap to Pay as a modern payment solution...",
                    fr: "Zoop devait prÃ©senter le Tap to Pay comme une solution moderne..."
                }
            },
            {
                type: "image",
                url: "https://res.cloudinary.com/dr5dbkh91/image/upload/f_auto,q_auto/v1770302664/projects/tap-to-pay-zoop/ifnqtscoz8nadanqrjhd.png",
                caption: { "pt": null, "en": null, "fr": null }
            }
            ]
    },
    "unsafe":{
        year: 2025,
        categories: ["animation"],
        thumbnail: "https://imgproxy.teia.rocks/befi2r1M5Zq2eoZ38-dtSS6OX7LQG2K4Y7p4rW05pnc/rs:fit:640:0:false/format:webp/plain/http://168.119.141.125:8080/ipfs/QmZwrseRCaAG1oQCiW7M22SZgXuA6YGdZRMZVmdCGgeahR", // colocar
        preview: "https://cache.teia.rocks/ipfs/QmeLLBHAx4Ztv3j2CLA1Nwq2hRmobwzFzHuHK9wk67fiyg", // colocar
        title: {
            en: "Reported as Unsafe",
            pt: "Reported as Unsafe",
            fr: "Reported as Unsafe"
        },
        credits: {
            agency: "NOO",
            direction: "Fernando Villela",
            programming: "Judd Buchannan"
        },
        content: [
            {
                type: "video",
                url: "https://youtube.com/embed/NOVLNrncpYw",
                caption: {
                    pt: "Entrega principal",
                    en: "Main deliverable",
                    fr: "Livrable principal"
                }
            },
            {
                type: "text",
                text: {
                    pt: "A Coca-cola precisava apresentar o Tap to Pay como uma soluÃ§Ã£o moderna...",
                    en: "Coca-cola needed to present Tap to Pay as a modern payment solution...",
                    fr: "Coca-cola devait prÃ©senter le Tap to Pay comme une solution moderne..."
                }
            },
            {
                type: "image",
                url: "https://res.cloudinary.com/dobmgp6ug/image/upload/f_auto,q_auto,so_0/v1772135204/Glued_On_The_Wall_Street_Posters_Mockup_2_va0boq.jpg",
                caption: { "pt": null, "en": null, "fr": null }
            },
            {
                type: "text",
                text: {
                    pt: "A Coca-cola precisava apresentar o Tap to Pay como uma soluÃ§Ã£o moderna...",
                    en: "Coca-cola needed to present Tap to Pay as a modern payment solution...",
                    fr: "Coca-cola devait prÃ©senter le Tap to Pay comme une solution moderne..."
                }
            },
            ]
    },
    "light-n-time":{
        year: 2026,
        categories: ["3d", "interactive"],
        thumbnail: "https://cache.teia.rocks/ipfs/Qmd2LSE6Lf2bjq6GoYrudUBXjxXaP7fksM4oi4UwcjrCyr", // colocar
        preview: "https://cache.teia.rocks/ipfs/Qmd2LSE6Lf2bjq6GoYrudUBXjxXaP7fksM4oi4UwcjrCyr", // colocar
        title: {
            en: "Light and Time",
            pt: "Light and Time",
            fr: "Light and Time"
        },
        credits: {
            agency: "NOO",
            direction: "Marcio Sal",
            programming: "Judd Buchannan"
        },
        content: [
            {
                type: "video",
                url: "https://youtube.com/embed/NOVLNrncpYw",
                caption: {
                    pt: "Entrega principal",
                    en: "Main deliverable",
                    fr: "Livrable principal"
                }
            },
            {
                type: "text",
                text: {
                    pt: "A Zoop precisava apresentar o Tap to Pay como uma soluÃ§Ã£o moderna...",
                    en: "Zoop needed to present Tap to Pay as a modern payment solution...",
                    fr: "Zoop devait prÃ©senter le Tap to Pay comme une solution moderne..."
                }
            },
            {
                type: "image",
                url: "https://res.cloudinary.com/dr5dbkh91/image/upload/f_auto,q_auto/v1770302664/projects/tap-to-pay-zoop/ifnqtscoz8nadanqrjhd.png",
                caption: { "pt": "Untitled 1", "en": "Untitled 1", "fr": "Untitled 1" }
            },
            {
                type: "image",
                url: "https://res.cloudinary.com/dr5dbkh91/image/upload/f_auto,q_auto/v1770302664/projects/tap-to-pay-zoop/ifnqtscoz8nadanqrjhd.png",
                caption: { "pt": "Untitled 2", "en": "Untitled 2", "fr": "Untitled 2" }
            },
            {
                type: "image",
                url: "https://res.cloudinary.com/dr5dbkh91/image/upload/f_auto,q_auto/v1770302664/projects/tap-to-pay-zoop/ifnqtscoz8nadanqrjhd.png",
                caption: { "pt": "Untitled 3", "en": "Untitled 3", "fr": "Untitled 3" }
            },
            {
                type: "image",
                url: "https://res.cloudinary.com/dr5dbkh91/image/upload/f_auto,q_auto/v1770302664/projects/tap-to-pay-zoop/ifnqtscoz8nadanqrjhd.png",
                caption: { "pt": "Untitled 4", "en": "Untitled 4", "fr": "Untitled 4" }
            }
            ]
    }
};