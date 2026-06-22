import 'package:carousel_slider/carousel_slider.dart';
import 'package:flutter/material.dart';

class OnBoardingPage extends StatefulWidget {
  const OnBoardingPage({super.key});

  @override
  State<OnBoardingPage> createState() => _OnBoardingPageState();
}

class _OnBoardingPageState extends State<OnBoardingPage> {
  final CarouselSliderController _controller = CarouselSliderController();

  int _currentIndex = 0;

  final items = [
    OnBoardingItem(
      imagePath: 'assets/on_boarding/on_boarding_1.png',
      title: 'Snap & Send via Telegram',
      description:
          'Skip the complicated apps. Just take a photo of your receipt and send it to our smart bot.',
    ),
    OnBoardingItem(
      imagePath: 'assets/on_boarding/on_boarding_2.png',
      title: 'Organize Your Expenses',
      description: 'Keep track of your spending with ease.',
    ),
    OnBoardingItem(
      imagePath: 'assets/on_boarding/on_boarding_3.png',
      title: 'Get Insights',
      description: 'Analyze your expenses and save money.',
    ),
  ];
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: CarouselSlider.builder(
                carouselController: _controller,
                itemCount: items.length,
                itemBuilder: (_, index, _) {
                  final item = items[index];
                  return Padding(
                    padding: EdgeInsets.all(16.0),
                    child: Container(
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(12),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(
                              alpha: 0.1,
                            ), // Shadow color with opacity
                            spreadRadius:
                                4, // Extent to which the box inflates before blur
                            blurRadius:
                                10, // Haziness/softness of the shadow edges
                            offset: const Offset(
                              0,
                              4,
                            ), // Shadow position displacement (x, y)
                          ),
                        ],
                      ),
                      child: Padding(
                        padding: EdgeInsets.all(32),
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            ClipOval(
                              child: Image.asset(item.imagePath, height: 250),
                            ),
                            const SizedBox(height: 24),
                            Text(
                              item.title,
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 32,
                                fontWeight: FontWeight.bold,
                                color: Colors.deepPurple,
                              ),
                            ),
                            const SizedBox(height: 16),
                            Text(
                              item.description,
                              textAlign: TextAlign.center,
                              style: TextStyle(fontSize: 16),
                            ),
                          ],
                        ),
                      ),
                    ),
                  );
                },
                options: CarouselOptions(
                  viewportFraction: 1,
                  height: double.infinity,
                  enableInfiniteScroll: false,
                  onPageChanged: (index, reason) {
                    setState(() {
                      _currentIndex = index;
                    });
                  },
                ),
              ),
            ),

            Padding(
              padding: EdgeInsets.symmetric(vertical: 24, horizontal: 24),
              child: Row(
                children: [
                  IconButton(
                    onPressed: _currentIndex == 0
                        ? null
                        : () {
                            _controller.previousPage();
                          },
                    icon: const Icon(Icons.arrow_back_ios),
                  ),
                  Expanded(child: buildIndicator()),
                  (_currentIndex == 2)
                      ? TextButton(
                          onPressed: () {},
                          child: Text(
                            "Skip",
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                              color: Colors.deepPurple,
                            ),
                          ),
                        )
                      : IconButton(
                          onPressed: () {
                            if (_currentIndex < items.length - 1) {
                              _controller.nextPage();
                            }
                          },
                          icon: const Icon(Icons.arrow_forward_ios),
                        ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget buildIndicator() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(items.length, (index) {
        final isActive = _currentIndex == index;

        return GestureDetector(
          onTap: () {
            _controller.animateToPage(index);
          },
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 250),
            curve: Curves.easeInOut,
            width: isActive ? 24 : 8,
            height: 8,
            margin: const EdgeInsets.symmetric(horizontal: 4),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(100),
              gradient: isActive
                  ? const LinearGradient(
                      begin: Alignment.centerLeft,
                      end: Alignment.centerRight,
                      colors: [Color(0xff5B2EFF), Color(0xffFF2E88)],
                    )
                  : null,
              color: isActive ? null : Colors.grey.shade300,
            ),
          ),
        );
      }),
    );
  }
}

class OnBoardingItem {
  final String imagePath;
  final String title;
  final String description;

  OnBoardingItem({
    required this.imagePath,
    required this.title,
    required this.description,
  });
}
