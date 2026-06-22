import 'package:flutter/material.dart';
import 'package:mobile_receipt_scanner/presentation/widgets/button/custom_button.dart';
import 'package:mobile_receipt_scanner/presentation/widgets/gradient_text/gradient_text_widget.dart';
import 'package:mobile_receipt_scanner/presentation/widgets/layouts/app_bar.dart';
import 'package:mobile_receipt_scanner/presentation/widgets/togle/custom_togle_widget.dart';

class TelegramLinkedPage extends StatefulWidget {
  const TelegramLinkedPage({super.key});

  @override
  State<TelegramLinkedPage> createState() => _TelegramLinkedPageState();
}

class _TelegramLinkedPageState extends State<TelegramLinkedPage> {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: AppBarLayout(
        textColor: Colors.deepPurple,
        child: Container(
          width: double.infinity,
          padding: EdgeInsets.all(16),
          child: Column(
            children: [
              Stack(
                children: [
                  Image.asset(
                    'assets/icon/telegram_linked_icon.png',
                    width: 130,
                  ),
                  Container(
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: Color(0xffEDE0FF),
                    ),
                    child: Icon(
                      Icons.telegram,
                      color: Colors.deepPurpleAccent,
                      size: 40,
                    ),
                  ),
                ],
              ),
              ConnectionToggle(),
              const SizedBox(height: 16),
              Text(
                "Link Telegram",
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 24),
              ),
              Text(
                "Send receipts directly via chat and watch them magically organize.",
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              _buildLinkTelegram(),
              const SizedBox(height: 16),
              _buildHowToLink(),
              const SizedBox(height: 24),
              AppButton(
                backgroundColor: Colors.transparent,
                gradient: LinearGradient(
                  colors: [Color(0xFF7C3AED), Color(0xFFEC4899)],
                ),
                icon: Icons.open_in_new,
                isAuth: false,
                onPressed: () {},
                child: Text(
                  "Open Telegram App",
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildLinkTelegram() {
    return Container(
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF6B1FFF), Color(0xFFFF4FA2)],
        ),
        borderRadius: BorderRadius.circular(22),
      ),
      padding: const EdgeInsets.only(top: 4),
      child: Container(
        decoration: BoxDecoration(
          color: const Color(0xFFF9F7FC),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Container(
          padding: EdgeInsets.all(16),
          width: double.infinity,
          child: Column(
            children: [
              Text(
                "YOUR LINK CODE",
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold),
              ),
              GradientText(
                "842-195",
                style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold),
                gradient: LinearGradient(
                  colors: [Color(0xFF7C3AED), Color(0xFFEC4899)],
                ),
              ),
              SizedBox(height: 12),
              Container(
                padding: EdgeInsets.symmetric(vertical: 6, horizontal: 14),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(16),
                  color: Colors.red.shade100,
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.timer, color: Colors.red),
                    Text(
                      "Expires in 09:59",
                      style: TextStyle(color: Colors.red, fontSize: 14),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHowToLink() {
    return Container(
      padding: EdgeInsets.all(16),
      width: double.infinity,
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        color: Colors.white,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text("How to link:", style: TextStyle(fontWeight: FontWeight.bold)),
          const SizedBox(height: 8),
          Row(
            children: [
              Container(
                width: 20,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.deepPurple,
                ),
                child: Text(
                  "1",
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.white),
                ),
              ),
              const SizedBox(width: 8),
              RichText(
                text: TextSpan(
                  style: TextStyle(fontSize: 14, color: Colors.black),
                  children: [
                    TextSpan(text: "Search for "),
                    TextSpan(
                      text: "@SmartReceiptBot ",
                      style: TextStyle(
                        color: Colors.deepPurple,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    TextSpan(text: "in Telegram"),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              Container(
                width: 20,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.deepPurple,
                ),
                child: Text(
                  "2",
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.white),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: RichText(
                  text: TextSpan(
                    style: TextStyle(fontSize: 14, color: Colors.black),
                    children: [
                      TextSpan(text: "Send the message "),
                      TextSpan(
                        text: "/link 842195 ",
                        style: TextStyle(
                          color: Colors.deepPurple,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
